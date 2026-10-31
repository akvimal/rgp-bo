import * as qrModule from "qrcode-generator";

// the package exports the generator function itself (CommonJS); the namespace import is that function at runtime
const qrcode: typeof qrModule = ((qrModule as any).default || qrModule) as any;

/** A QR code as one SVG path: the size in modules and the path of its dark squares. null when the text cannot be encoded (too long). */
export function qrPath(text: string): { size: number, d: string } | null {
    try {
        const qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        const size = qr.getModuleCount();
        let d = '';
        for (let r = 0; r < size; r++)
            for (let c = 0; c < size; c++)
                if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
        return { size, d };
    } catch {
        return null;
    }
}
