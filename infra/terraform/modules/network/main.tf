# Network: VPC, public/private subnets across 2 AZs, route tables, IGW, VPC
# endpoints (keep AWS-API traffic off the NAT path), and a cost-guarded egress:
# a fck-nat instance for dev (cheap) or a managed NAT Gateway for prod.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs  = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = merge(var.tags, { module = "network" })
}

resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = merge(local.tags, { Name = "${var.name}-vpc" })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = "${var.name}-igw" })
}

resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.cidr_block, 4, count.index)
  map_public_ip_on_launch = true
  tags                    = merge(local.tags, { Name = "${var.name}-public-${count.index}", tier = "public" })
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.this.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.cidr_block, 4, count.index + 8)
  tags              = merge(local.tags, { Name = "${var.name}-private-${count.index}", tier = "private" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  tags = merge(local.tags, { Name = "${var.name}-public-rt" })
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags   = merge(local.tags, { Name = "${var.name}-private-rt" })
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# --- Egress: managed NAT GW (prod) OR fck-nat instance (dev) -----------------
resource "aws_eip" "nat" {
  count  = var.use_managed_nat ? 1 : 0
  domain = "vpc"
  tags   = merge(local.tags, { Name = "${var.name}-nat-eip" })
}

resource "aws_nat_gateway" "this" {
  count         = var.use_managed_nat ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
  tags          = merge(local.tags, { Name = "${var.name}-nat" })
  depends_on    = [aws_internet_gateway.this]
}

resource "aws_route" "private_nat" {
  count                  = var.use_managed_nat ? 1 : 0
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[0].id
}

# fck-nat: a t4g.nano Spot NAT instance for dev egress (~$3-5/mo vs ~$32+/mo).
# Trade-off (see README): single-AZ, no HA, manual recovery — fine for dev.
resource "aws_security_group" "fck_nat" {
  count       = var.use_managed_nat ? 0 : 1
  name        = "${var.name}-fck-nat"
  description = "fck-nat instance"
  vpc_id      = aws_vpc.this.id
  ingress {
    description = "From VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(local.tags, { Name = "${var.name}-fck-nat" })
}

data "aws_ami" "fck_nat" {
  count       = var.use_managed_nat ? 0 : 1
  most_recent = true
  owners      = ["568608671756"] # fck-nat publisher
  filter {
    name   = "name"
    values = ["fck-nat-al2023-*-arm64-ebs"]
  }
}

resource "aws_instance" "fck_nat" {
  count                       = var.use_managed_nat ? 0 : 1
  ami                         = data.aws_ami.fck_nat[0].id
  instance_type               = var.nat_instance_type
  subnet_id                   = aws_subnet.public[var.nat_subnet_index].id
  associate_public_ip_address = true
  source_dest_check           = false
  vpc_security_group_ids      = [aws_security_group.fck_nat[0].id]
  # On-demand by default: one-time Spot for a t4g.nano is flaky (capacity gaps
  # leave the request unfulfilled) and the on-demand price is trivial (~$3/mo).
  dynamic "instance_market_options" {
    for_each = var.use_spot_nat ? [1] : []
    content {
      market_type = "spot"
      spot_options { spot_instance_type = "one-time" }
    }
  }
  tags = merge(local.tags, { Name = "${var.name}-fck-nat" })
}

resource "aws_route" "private_fck_nat" {
  count                  = var.use_managed_nat ? 0 : 1
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = aws_instance.fck_nat[0].primary_network_interface_id
}

# --- VPC endpoints: keep S3/Secrets/ECR/Logs traffic off the NAT path --------
resource "aws_security_group" "endpoints" {
  name        = "${var.name}-vpce"
  description = "Interface VPC endpoints"
  vpc_id      = aws_vpc.this.id
  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.cidr_block]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(local.tags, { Name = "${var.name}-vpce" })
}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = merge(local.tags, { Name = "${var.name}-s3-vpce" })
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(["secretsmanager", "ecr.api", "ecr.dkr", "logs"])
  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${var.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true
  tags                = merge(local.tags, { Name = "${var.name}-${each.value}-vpce" })
}
