
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { CheckCircle2, AlertCircle, Monitor, Camera, Mic } from "lucide-react";

const GuideDialog = ({ children }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl h-[80vh]">
        <DialogHeader>
          <DialogTitle>Exam Preparation & System Requirements Guide</DialogTitle>
          <DialogDescription>
            Please review these guidelines carefully before starting your exam.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-full pr-4">
          <div className="space-y-6 pb-6">
            
            {/* System Requirements */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-600">
                <Monitor className="w-5 h-5" />
                System Requirements
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" /> Webcam
                  </h4>
                  <ul className="text-sm space-y-1 text-slate-600">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Working webcam required</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Face must be clearly visible</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Adequate lighting</li>
                  </ul>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-slate-500" /> Audio
                  </h4>
                  <ul className="text-sm space-y-1 text-slate-600">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Microphone must be active</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> Quiet environment required</li>
                    <li className="flex gap-2"><AlertCircle className="w-4 h-4 text-amber-500 shrink-0" /> No background noise</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Exam Rules */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-600">
                <AlertCircle className="w-5 h-5" />
                Exam Rules & Regulations
              </h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <p className="text-sm text-amber-800 font-medium">Strict adherence to these rules is mandatory. Violations may result in exam termination.</p>
                <ul className="space-y-2 text-sm text-amber-900">
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-600">1.</span>
                    No unauthorized materials, devices, or people in the room.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-600">2.</span>
                    Full-screen mode is enforced. Do not switch tabs or minimize the browser.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-600">3.</span>
                    Stay in view of the camera at all times.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-amber-600">4.</span>
                    Ensure stable internet connection throughout the session.
                  </li>
                </ul>
              </div>
            </section>

            {/* Process Overview */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-600">
                <CheckCircle2 className="w-5 h-5" />
                Verification Process
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">1</div>
                  <div>
                    <h4 className="font-medium">Identity Verification</h4>
                    <p className="text-sm text-slate-600">Upload or capture a photo of your ID card alongside your face.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">2</div>
                  <div>
                    <h4 className="font-medium">Environment Scan</h4>
                    <p className="text-sm text-slate-600">System will check for multiple faces, unauthorized objects, or suspicious audio levels.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold shrink-0">3</div>
                  <div>
                    <h4 className="font-medium">Start Exam</h4>
                    <p className="text-sm text-slate-600">Once verified, exam timer begins. Remain focused on screen.</p>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default GuideDialog;
