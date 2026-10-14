import React from 'react';
import { SchoolReadinessItem } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Copy, ExternalLink } from 'lucide-react';
import { normalizeWhatsappNumber, generateWaMessage } from './readinessConstants';

interface WhatsAppReminderModalProps {
  school: SchoolReadinessItem | null;
  onClose: () => void;
  onCopy: (school: SchoolReadinessItem) => void;
  onSend: (school: SchoolReadinessItem) => void;
}

export function WhatsAppReminderModal({
  school,
  onClose,
  onCopy,
  onSend,
}: WhatsAppReminderModalProps) {
  if (!school) return null;

  const rawPhone = school.kepala_whatsapp || school.telepon;
  const normalizedPhone = normalizeWhatsappNumber(rawPhone);

  return (
    <Dialog open={Boolean(school)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <span>Template Pengingat WhatsApp</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Pemberitahuan resmi kelengkapan data untuk <b>{school.nama}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Nomor WhatsApp Terdata:
              </span>
              <span className="font-mono font-bold text-slate-800">
                {rawPhone || '(Belum ada nomor telepon)'}
              </span>
            </div>
            {Boolean(rawPhone) && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                Tersedia
              </Badge>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              Isi Pesan:
            </span>
            <div className="p-3 bg-slate-100/70 rounded-xl border border-slate-200 text-xs font-mono text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {generateWaMessage(school)}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onCopy(school)}
              className="rounded-xl font-bold text-xs gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Pesan</span>
            </Button>

            {normalizedPhone ? (
              <Button
                onClick={() => {
                  onSend(school);
                  onClose();
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-extrabold text-xs gap-1.5 px-4"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka WhatsApp Web / App</span>
              </Button>
            ) : (
              <Button disabled className="rounded-xl font-bold text-xs opacity-50">
                Nomor Tidak Tersedia
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
