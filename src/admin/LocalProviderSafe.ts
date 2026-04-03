import { BaseProvider } from '@adminjs/upload';
import path from 'path';
import fs from 'fs';
import * as url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LocalProviderSafe extends BaseProvider {
  constructor(options: { bucket: string; opts?: any }) {
    super(options.bucket, options.opts);
    if (!fs.existsSync(this.bucket)) {
      fs.mkdirSync(this.bucket, { recursive: true });
    }
  }

  public async upload(file: any, key: string): Promise<any> {
    const filePath = path.join(this.bucket, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.copyFile(file.path, filePath);
    await fs.promises.unlink(file.path);
    return key;
  }

  public async delete(key: string, _bucket: string): Promise<any> {
    const filePath = path.join(this.bucket, key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  public path(key: string, _bucket: string): string {
    return path.join(this.opts.baseUrl || '/', key);
  }
}
