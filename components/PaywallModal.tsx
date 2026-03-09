import React from 'react';
import { Modal } from 'react-native';
import Paywall from '@/components/Paywall';

interface PaywallModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export default function PaywallModal({ visible, onDismiss }: PaywallModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <Paywall onDismiss={onDismiss} />
    </Modal>
  );
}
