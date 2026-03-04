import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { setProcessingResult } from "@/lib/store";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<any[][] | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleFile = useCallback((f: File) => {
    const validExts = [".xlsx", ".xls", ".csv", ".numbers"];
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      toast({ title: "Hata", description: "Desteklenmeyen dosya formati. .xlsx, .xls, .csv veya .numbers kullanin.", variant: "destructive" });
      return;
    }
    setFile(f);
    setResult(null);

    if (f.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n").filter(l => l.trim());
          const data = lines.slice(0, 11).map(l => l.split(",").map(c => c.trim()));
          setPreview(data);
        } catch {
          setPreview(null);
        }
      };
      reader.readAsText(f);
    } else {
      setPreview(null);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Yukleme hatasi");
      }
      const data = await res.json();
      setResult(data);
      setProcessingResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      toast({ title: "Basarili", description: `${data.totalRecords} kayit islendi, ${data.totalEmployees} personel tespit edildi.` });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-upload-title">Veri Yukle</h1>
        <p className="text-sm text-muted-foreground">Parmak izi okuyucudan alinan Excel/CSV dosyasini yukleyin</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-md p-12 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-border"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            data-testid="dropzone-upload"
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet className="h-12 w-12 text-primary" />
                <div>
                  <p className="font-medium" data-testid="text-file-name">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                  data-testid="button-remove-file"
                >
                  Dosyayi Kaldir
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <UploadIcon className="h-12 w-12 text-muted-foreground opacity-40" />
                <div>
                  <p className="font-medium">Dosyayi surukle birak veya secin</p>
                  <p className="text-sm text-muted-foreground">.xlsx, .xls, .csv, .numbers desteklenir</p>
                </div>
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.numbers"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    data-testid="input-file-upload"
                  />
                  <Badge variant="default" className="cursor-pointer">Dosya Sec</Badge>
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Veri Onizleme (Ilk 10 satir)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview[0]?.map((h: any, i: number) => (
                      <TableHead key={i} className="font-mono text-xs whitespace-nowrap">{String(h)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(1).map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell: any, j: number) => (
                        <TableCell key={j} className="font-mono text-xs whitespace-nowrap">{String(cell ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {file && !result && (
        <div className="flex justify-center">
          <Button onClick={handleUpload} disabled={uploading} size="lg" data-testid="button-process">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Isleniyor...
              </>
            ) : (
              "Raporu Olustur"
            )}
          </Button>
        </div>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Isleme Sonucu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Toplam Kayit</p>
                <p className="text-xl font-bold font-mono" data-testid="text-total-records">{result.totalRecords}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Personel Sayisi</p>
                <p className="text-xl font-bold font-mono" data-testid="text-total-employees">{result.totalEmployees}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hata Sayisi</p>
                <p className="text-xl font-bold font-mono">{result.errors?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Durum</p>
                <Badge variant="default">Tamamlandi</Badge>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Hatalar
                </p>
                {result.errors.slice(0, 5).map((e: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground font-mono">{e}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2 flex-wrap">
              <Button onClick={() => setLocation("/")} data-testid="button-go-dashboard">
                Dashboard'a Git
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.open(`/api/export/${result.uploadId}`, "_blank");
                }}
                data-testid="button-export-excel"
              >
                Excel Indir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
