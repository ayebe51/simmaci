import React from "react";
import SoftPageHeader from "@/components/ui/SoftPageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function UserListPage() {
  return (
    <div className="space-y-6">
      <SoftPageHeader
        title="Manajemen User"
        description="Kelola akses Operator Sekolah dan Admin"
      >
      </SoftPageHeader>
      <Card>
          <CardContent className="p-10 text-center">
              <h2 className="text-xl font-bold">Fitur Sedang Dalam Perbaikan</h2>
              <p>Mohon tunggu sebentar, kami sedang memperbaiki halaman ini.</p>
          </CardContent>
      </Card>
    </div>
  );
}
