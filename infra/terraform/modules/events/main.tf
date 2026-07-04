# Async side-effects: SQS queues (+ DLQs) for email, web-push and the periodic
# dashboard refresh, plus an EventBridge bus and a scheduled refresh rule.

locals {
  tags   = merge(var.tags, { module = "events" })
  queues = ["emails", "webpush", "refresh"]
}

resource "aws_sqs_queue" "dlq" {
  for_each                  = toset(local.queues)
  name                      = "${var.name}-${each.value}-dlq"
  message_retention_seconds = 1209600 # 14 days
  kms_master_key_id         = var.kms_key_arn
  tags                      = local.tags
}

resource "aws_sqs_queue" "main" {
  for_each                   = toset(local.queues)
  name                       = "${var.name}-${each.value}"
  visibility_timeout_seconds = 60
  kms_master_key_id          = var.kms_key_arn
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.value].arn
    maxReceiveCount     = 5
  })
  tags = local.tags
}

resource "aws_cloudwatch_event_bus" "this" {
  name = "${var.name}-bus"
  tags = local.tags
}

# Periodic dashboard refresh → drops a message on the refresh queue.
resource "aws_cloudwatch_event_rule" "refresh" {
  name                = "${var.name}-refresh"
  schedule_expression = var.refresh_schedule
  tags                = local.tags
}

resource "aws_cloudwatch_event_target" "refresh" {
  rule      = aws_cloudwatch_event_rule.refresh.name
  arn       = aws_sqs_queue.main["refresh"].arn
  target_id = "refresh-queue"
}

# Allow EventBridge to write to the refresh queue.
resource "aws_sqs_queue_policy" "refresh" {
  queue_url = aws_sqs_queue.main["refresh"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "events.amazonaws.com" }
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.main["refresh"].arn
      Condition = { ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.refresh.arn } }
    }]
  })
}
