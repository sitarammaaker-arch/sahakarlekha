/**
 * आपूर्तिकर्ता भुगतान — Make Payment (Bill-wise / "Against Reference"), supplier side.
 * Thin wrapper around the shared BillWiseSettlement panel.
 */
import React from 'react';
import BillWiseSettlement from '@/components/BillWiseSettlement';

const MakePayment: React.FC = () => (
  <div className="max-w-5xl">
    <BillWiseSettlement mode="pay" />
  </div>
);

export default MakePayment;
