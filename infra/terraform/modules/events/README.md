# events module

SQS queues (`emails`, `webpush`, `refresh`) each with a 14-day DLQ and a
maxReceiveCount=5 redrive, KMS-encrypted. An EventBridge bus plus a scheduled
rule (default every 5 min) that enqueues the periodic dashboard refresh. App
side-effects (Brevo sends, web-push, refresh jobs) are Lambda consumers of these
queues. Outputs: `queue_arns`, `queue_urls`, `event_bus_arn`.
