# API compute: NestJS behind a Lambda (Node 20, arm64) + API Gateway HTTP API.
# Because Nest sits behind a standard HTTP adapter, the same image can move to
# ECS Fargate / App Runner later without a rewrite — see fargate.tf.disabled and
# var.compute. Provisioned concurrency is OFF at MVP (scale-to-zero).

locals {
  tags = merge(var.tags, { module = "api" })
}

# --- IAM (least privilege) ---------------------------------------------------
resource "aws_iam_role" "lambda" {
  name = "${var.name}-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "app" {
  name = "app"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = concat([var.db_secret_arn], var.provider_secret_arns)
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [var.kms_key_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = var.sqs_queue_arns
      }
    ]
  })
}

resource "aws_security_group" "lambda" {
  name        = "${var.name}-api"
  description = "API Lambda ENIs"
  vpc_id      = var.vpc_id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

# --- Lambda ------------------------------------------------------------------
resource "aws_lambda_function" "api" {
  function_name = "${var.name}-api"
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs20.x"
  architectures = ["arm64"]
  handler       = "lambda.handler"
  filename      = var.lambda_zip # CI builds & uploads; see RUNBOOK + deploy.yml
  memory_size   = var.memory_size
  timeout       = 30

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      PILOTAGE_ENV          = var.env
      AUTH_DEV_BYPASS       = "false"
      CORS_ORIGINS          = var.cors_origins
      DB_PROXY_ENDPOINT     = var.db_proxy_endpoint
      DB_SECRET_ARN         = var.db_secret_arn
      COGNITO_USER_POOL_ID  = var.cognito_user_pool_id
      COGNITO_CLIENT_ID     = var.cognito_client_id
      COGNITO_REGION        = var.region
    }
  }

  # Application code is managed by the CD pipeline, not Terraform.
  lifecycle {
    ignore_changes = [filename, source_code_hash, environment]
  }
  tags = local.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.tags
}

# --- API Gateway HTTP API ----------------------------------------------------
resource "aws_apigatewayv2_api" "this" {
  name          = "${var.name}-http"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = split(",", var.cors_origins)
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "content-type"]
  }
  tags = local.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proxy" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = var.throttle_burst
    throttling_rate_limit  = var.throttle_rate
  }
  tags = local.tags
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

resource "aws_wafv2_web_acl_association" "api" {
  count        = var.web_acl_arn == null ? 0 : 1
  resource_arn = aws_apigatewayv2_stage.default.arn
  web_acl_arn  = var.web_acl_arn
}
