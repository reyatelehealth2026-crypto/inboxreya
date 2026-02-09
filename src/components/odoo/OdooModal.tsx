'use client';

/**
 * Odoo Modal Component
 * Full-screen modal dialog for Odoo ERP features
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OdooPanel } from './OdooPanel';

interface OdooModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    customerPartnerCode?: string;
}

export function OdooModal({ open, onOpenChange, customerPartnerCode }: OdooModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl h-[80vh] p-0 flex flex-col">
                <DialogHeader className="sr-only">
                    <DialogTitle>CNY ERP</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <OdooPanel
                        customerPartnerCode={customerPartnerCode}
                        onClose={() => onOpenChange(false)}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default OdooModal;
