variable "name" {
  type        = string
  description = "Name prefix, e.g. pilotage-dev."
}

variable "region" {
  type        = string
  description = "AWS region."
}

variable "cidr_block" {
  type        = string
  default     = "10.20.0.0/16"
  description = "VPC CIDR."
}

variable "use_managed_nat" {
  type        = bool
  default     = false
  description = "true = managed NAT Gateway (prod); false = fck-nat instance (dev)."
}

variable "use_spot_nat" {
  type        = bool
  default     = false
  description = "Run the fck-nat instance on Spot. Off by default: one-time Spot for t4g.nano is unreliable and on-demand is ~$3/mo."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Base tags applied to all resources."
}
