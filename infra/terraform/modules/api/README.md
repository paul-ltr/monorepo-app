# api module

NestJS API as a Node 20 / arm64 Lambda behind an API Gateway HTTP API
(`ANY /{proxy+}` → AWS_PROXY). Least-privilege IAM (read the DB + provider
secrets, decrypt with the project KMS key, send SQS), VPC-attached for RDS Proxy
access, log retention 14d, request throttling on the stage, optional regional
WAF association. Provisioned concurrency OFF (scale-to-zero).

Application code is owned by CD (deploy.yml bundles `src/lambda.ts` with esbuild
+ a decorator-metadata plugin, zips, and `update-function-code`); Terraform
ignores code changes (`lifecycle.ignore_changes`).

**Migration path:** `var.compute = "fargate"` → see `fargate.tf.disabled` for the
ECS/App Runner variant. The same Nest app runs unchanged.

Outputs: `function_name`, `api_endpoint`, `api_id`.
