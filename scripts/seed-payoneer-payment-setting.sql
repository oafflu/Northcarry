-- Seed Payoneer Checkout admin_settings row (safe to run multiple times)
INSERT INTO admin_settings (setting_key, setting_value, setting_category, description)
VALUES (
  'payoneer',
  '{
    "enabled": false,
    "public_key": "",
    "secret_key": "",
    "mode": "sandbox",
    "client_id": "",
    "integration_mode": "hosted",
    "api_base_url": "",
    "initialize_url": "",
    "verify_url": "",
    "checkout_url_template": "",
    "callback_url": "",
    "webhook_secret": "",
    "checkout_label": ""
  }'::jsonb,
  'payment',
  'Payoneer Checkout payment gateway settings'
)
ON CONFLICT (setting_key) DO NOTHING;
