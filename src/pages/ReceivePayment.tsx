/**
 * भुगतान प्राप्ति — Receive Payment (Bill-wise / "Against Reference"), customer side.
 * Thin wrapper around the shared BillWiseSettlement panel.
 */
import React from 'react';
import BillWiseSettlement from '@/components/BillWiseSettlement';

const ReceivePayment: React.FC = () => (
  <div className="max-w-5xl">
    <BillWiseSettlement mode="receive" />
  </div>
);

export default ReceivePayment;
