import React from 'react';
import QRCode from 'react-qr-code';
import { SCHOOL_NAME } from '../utils';

export default function ParentInstructionSlip() {
  // Use VITE_PUBLIC_URL if defined (useful when printing from localhost but wanting the production URL in the QR code),
  // otherwise dynamically use the current domain the app is running on.
  const baseUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
  const portalUrl = `${baseUrl}/lookup`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6 print:p-0 print:bg-white">
      {/* Non-printable back button */}
      <div className="fixed top-4 left-4 print:hidden">
        <button 
          onClick={() => window.history.back()}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-slate-700"
        >
          ← Back
        </button>
      </div>
      
      {/* Non-printable print button */}
      <div className="fixed top-4 right-4 print:hidden">
        <button 
          onClick={() => window.print()}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700"
        >
          🖨️ Print Slip
        </button>
      </div>

      {/* The Printable Slip */}
      <div className="bg-white w-full max-w-2xl border-4 border-slate-900 rounded-3xl p-8 shadow-2xl print:shadow-none print:border-2 print:m-0 print:rounded-xl">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="College Logo" className="h-16 object-contain mx-auto mb-4" />
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight">Parent Portal Guide</h1>
          <p className="text-xl text-slate-600 mt-2 font-medium">Track your child's {SCHOOL_NAME} bus in real-time</p>
        </div>

        <hr className="border-slate-200 border-2 my-6" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Step 1: Go to the Portal</h2>
              <p className="text-slate-600">Scan the QR code or visit:</p>
              <div className="bg-slate-100 p-3 rounded-lg font-mono font-bold text-lg text-primary mt-2 break-all border border-slate-200">
                {portalUrl}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Step 2: Enter Details</h2>
              <ul className="space-y-3 text-slate-700 font-medium">
                <li className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Your child's <strong>Student ID</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  The <strong>last 4 digits</strong> of your registered phone number
                </li>
              </ul>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-sm">
              <strong>Note:</strong> No complicated passwords required. Your child's privacy is protected by this dual-verification method.
            </div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white border-2 border-slate-200 p-6 rounded-2xl shadow-sm">
            <QRCode value={portalUrl} size={180} />
            <p className="mt-4 font-bold text-slate-600 tracking-widest uppercase text-sm">Scan to Track</p>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-500 text-sm font-medium">
          Please keep this slip secure or save a photo of it for future reference.
        </div>
      </div>
    </div>
  );
}
