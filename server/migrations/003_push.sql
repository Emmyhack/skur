-- Device push, delivered through Expo's push service. The endpoint is the device's Expo push
-- token; the delivery loop refuses anything that does not look like one.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_channel_check;
ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_channel_check
  CHECK (channel IN ('webhook', 'email', 'log', 'push'));

-- Every notification carries the deep link that opens the thing it is about, so tapping one lands
-- on the proposal rather than on the home screen with homework.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT;
