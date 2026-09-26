import React, { useState } from 'react';
import { X, ShieldCheck, CreditCard, Smartphone, Landmark, CheckCircle2, BadgeIndianRupee } from 'lucide-react';
import confetti from 'canvas-confetti';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type PayMethod = 'card' | 'upi' | 'netbanking';

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [method, setMethod] = useState<PayMethod>('card');
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [upiId, setUpiId] = useState('test@okhdfc');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [paymentId, setPaymentId] = useState('');

  if (!isOpen) return null;

  const orderId = 'order_dummy_PULSE01';
  const amount = '₹1,650.00';

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'idle') return;
    setStatus('processing');

    // Dummy Razorpay flow — no network call, simulates gateway latency
    setTimeout(() => {
      const fakeId = `pay_dummy_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      setPaymentId(fakeId);
      setStatus('success');
      try {
        localStorage.setItem('pulse_pro_plan', JSON.stringify({ plan: 'pro', paymentId: fakeId, at: new Date().toISOString() }));
      } catch {
        /* storage unavailable */
      }
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#3395ff', '#00e676', '#ffffff'] });
    }, 1800);
  };

  const handleDone = () => {
    setStatus('idle');
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    if (status === 'processing') return;
    setStatus('idle');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title-group">
            <BadgeIndianRupee size={18} className="text-accent-blue" />
            <h2 className="modal-title">Upgrade to Pro</h2>
          </div>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {status !== 'success' ? (
          <form onSubmit={handlePay}>
            <div className="modal-body">
              <div className="rzp-test-banner">
                <ShieldCheck size={14} />
                <span><strong>Razorpay Test Mode</strong> — dummy checkout, no real money moves.</span>
              </div>

              <div className="rzp-order-box">
                <div>
                  <div className="rzp-merchant">PULSE</div>
                  <div className="rzp-order-id">Order {orderId}</div>
                </div>
                <div className="rzp-amount">{amount}<span>/mo</span></div>
              </div>

              <div className="rzp-plan-row">
                <div className="rzp-plan-active">Pro — unlimited projects, Slack + email alerts, 10M edge requests</div>
              </div>

              <div className="rzp-method-tabs" role="tablist">
                <button type="button" className={`rzp-method-tab ${method === 'card' ? 'active' : ''}`} onClick={() => setMethod('card')}>
                  <CreditCard size={14} /> Card
                </button>
                <button type="button" className={`rzp-method-tab ${method === 'upi' ? 'active' : ''}`} onClick={() => setMethod('upi')}>
                  <Smartphone size={14} /> UPI
                </button>
                <button type="button" className={`rzp-method-tab ${method === 'netbanking' ? 'active' : ''}`} onClick={() => setMethod('netbanking')}>
                  <Landmark size={14} /> Netbanking
                </button>
              </div>

              {method === 'card' && (
                <div className="rzp-form-grid">
                  <label className="form-label">Card number (test: 4111…)</label>
                  <input className="rzp-input" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} inputMode="numeric" placeholder="4111 1111 1111 1111" required />
                  <div className="rzp-two-col">
                    <div>
                      <label className="form-label">Expiry</label>
                      <input className="rzp-input" value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" required />
                    </div>
                    <div>
                      <label className="form-label">CVV</label>
                      <input className="rzp-input" value={cvv} onChange={(e) => setCvv(e.target.value)} inputMode="numeric" placeholder="123" required />
                    </div>
                  </div>
                </div>
              )}

              {method === 'upi' && (
                <div className="rzp-form-grid">
                  <label className="form-label">UPI ID (test: test@okhdfc)</label>
                  <input className="rzp-input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" required />
                  <p className="rzp-hint">A collect request will be simulated — auto-approved in test mode.</p>
                </div>
              )}

              {method === 'netbanking' && (
                <div className="rzp-form-grid">
                  <label className="form-label">Bank</label>
                  <select className="rzp-input" defaultValue="HDFC">
                    <option>HDFC (test)</option>
                    <option>SBI (test)</option>
                    <option>ICICI (test)</option>
                  </select>
                  <p className="rzp-hint">Redirect is simulated — you stay on this page in dummy mode.</p>
                </div>
              )}
            </div>

            <footer className="modal-footer">
              <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleClose} disabled={status === 'processing'}>
                Cancel
              </button>
              <button type="submit" className="rzp-pay-btn" disabled={status === 'processing'}>
                {status === 'processing' ? 'Processing via Razorpay…' : `Pay ${amount}`}
              </button>
            </footer>
          </form>
        ) : (
          <div className="modal-body">
            <div className="feedback-success-state">
              <div className="success-icon-wrapper">
                <CheckCircle2 size={44} className="text-status-ready" />
              </div>
              <h3>Payment successful</h3>
              <p>Pro activated on your workspace.<br />Payment ID: <code>{paymentId}</code></p>
              <button className="btn btn-github" style={{ marginTop: '16px' }} onClick={handleDone}>
                Start using Pro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
