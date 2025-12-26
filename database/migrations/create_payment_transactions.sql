-- Create payment_transactions table for tracking real money transfers
-- This table stores records of actual payments made through the app

CREATE TABLE IF NOT EXISTS amot.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Payment participants
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optional: link to specific bill if paying a bill
  bill_id UUID REFERENCES amot.bills(id) ON DELETE SET NULL,

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'PHP',

  -- Payment method and gateway info
  payment_method VARCHAR(50) NOT NULL, -- 'gcash', 'paymaya', 'card', 'manual'
  gateway_provider VARCHAR(50), -- 'paymongo', 'xendit', etc.
  gateway_transaction_id VARCHAR(255), -- Transaction ID from payment gateway
  gateway_response JSONB, -- Store full gateway response for reference

  -- Payment status
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'

  -- Additional metadata
  description TEXT,
  metadata JSONB, -- Store additional info like fees, etc.

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  refunded_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT different_users CHECK (from_user_id != to_user_id)
);

-- Add indexes for common queries
CREATE INDEX idx_payment_transactions_from_user ON amot.payment_transactions(from_user_id);
CREATE INDEX idx_payment_transactions_to_user ON amot.payment_transactions(to_user_id);
CREATE INDEX idx_payment_transactions_bill ON amot.payment_transactions(bill_id);
CREATE INDEX idx_payment_transactions_status ON amot.payment_transactions(status);
CREATE INDEX idx_payment_transactions_gateway_id ON amot.payment_transactions(gateway_transaction_id);
CREATE INDEX idx_payment_transactions_created_at ON amot.payment_transactions(created_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE amot.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment transactions (sent or received)
CREATE POLICY payment_transactions_select_own ON amot.payment_transactions
  FOR SELECT
  USING (
    auth.uid() = from_user_id OR
    auth.uid() = to_user_id
  );

-- Users can create payment transactions where they are the sender
CREATE POLICY payment_transactions_insert_own ON amot.payment_transactions
  FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

-- Only system/backend can update payment status (handled via backend API)
-- Users cannot directly update payment transactions
CREATE POLICY payment_transactions_no_user_update ON amot.payment_transactions
  FOR UPDATE
  USING (false);

-- Users cannot delete payment transactions (for audit trail)
CREATE POLICY payment_transactions_no_delete ON amot.payment_transactions
  FOR DELETE
  USING (false);

-- Add trigger to update bill_splits.settled status when payment is completed
CREATE OR REPLACE FUNCTION amot.update_bill_splits_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- If payment is completed and linked to a bill
  IF NEW.status = 'completed' AND NEW.bill_id IS NOT NULL THEN
    -- Mark the corresponding bill split as settled
    UPDATE amot.bill_splits
    SET
      settled = true,
      settled_at = NEW.completed_at
    WHERE
      bill_id = NEW.bill_id AND
      user_id = NEW.from_user_id;
  END IF;

  -- If payment is refunded
  IF NEW.status = 'refunded' AND NEW.bill_id IS NOT NULL THEN
    -- Unmark the bill split
    UPDATE amot.bill_splits
    SET
      settled = false,
      settled_at = NULL
    WHERE
      bill_id = NEW.bill_id AND
      user_id = NEW.from_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_transaction_status_update
  AFTER UPDATE OF status ON amot.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION amot.update_bill_splits_on_payment();

-- Add comments for documentation
COMMENT ON TABLE amot.payment_transactions IS 'Stores real money payment transactions processed through payment gateways or marked manually';
COMMENT ON COLUMN amot.payment_transactions.payment_method IS 'Payment method used: gcash, paymaya, card, or manual (paid outside app)';
COMMENT ON COLUMN amot.payment_transactions.status IS 'Payment status: pending, processing, completed, failed, or refunded';
COMMENT ON COLUMN amot.payment_transactions.gateway_transaction_id IS 'Unique transaction ID from the payment gateway provider';
