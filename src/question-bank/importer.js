import { saveBankPackage } from '../storage/repositories/banks.js';
import {
  readQuestionBankFolder,
  readQuestionBankJson,
  readQuestionBankZip,
} from './package-reader.js';

export async function inspectQuestionBankFile(file) {
  if (!file) throw new Error('尚未選擇題庫檔案。');
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.zip')) return readQuestionBankZip(file);
  if (name.endsWith('.json')) return readQuestionBankJson(file);
  throw new Error('目前只支援 .zip 或 .json 題庫。');
}

export function inspectQuestionBankFolder(fileList) {
  return readQuestionBankFolder(fileList);
}

export async function importInspectedPackage(pkg) {
  if (!pkg?.report?.valid) {
    const count = pkg?.report?.summary?.errors ?? 0;
    throw new Error(`題庫驗證未通過，仍有 ${count} 個錯誤。`);
  }
  await saveBankPackage({
    manifest: pkg.manifest,
    questions: pkg.questions,
    assets: pkg.assets || [],
    sourceType: 'user',
    sourceMetadata: {
      importKind: pkg.source?.kind || 'file',
      importName: pkg.source?.name || '',
    },
    importedAt: new Date().toISOString(),
  });
  return pkg.manifest.id;
}

export async function importAuthorPackage(pkg) {
  if (!pkg?.report?.valid) {
    const count = pkg?.report?.summary?.errors ?? 0;
    throw new Error(`作者題庫驗證未通過，仍有 ${count} 個錯誤。`);
  }

  const catalogEntry = pkg.source?.catalogEntry || {};
  await saveBankPackage({
    manifest: pkg.manifest,
    questions: pkg.questions,
    assets: pkg.assets || [],
    sourceType: 'author',
    sourceMetadata: {
      catalogId: catalogEntry.id || pkg.manifest.id,
      catalogVersion: catalogEntry.version || pkg.manifest.version,
      catalogAuthor: catalogEntry.author || pkg.manifest.author || '',
      installedFrom: 'author-catalog',
    },
    importedAt: new Date().toISOString(),
  });
  return pkg.manifest.id;
}
