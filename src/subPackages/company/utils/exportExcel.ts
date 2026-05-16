/**
 * 前端导出 Excel（商品/套餐等），小程序内写入临时文件后 openDocument 打开
 * 置于 company 分包，避免主包引入 xlsx 等大依赖
 */
import * as XLSX from 'xlsx';

function getCategoryPath(cat: any): string {
  if (!cat?.name) return '未分类';
  const parts: string[] = [];
  let c: any = cat;
  while (c?.name) {
    parts.unshift(String(c.name).trim());
    c = c.category;
  }
  return parts.length ? parts.join(' / ') : '未分类';
}

/** 将媒体数组格式化为字符串（file_type: file_url，多个用分号+空格分隔） */
function formatMedias(medias: any): string {
  if (!Array.isArray(medias) || medias.length === 0) return '';
  return medias
    .map((m: any) => {
      const url = m?.file_url ?? m?.url ?? '';
      const type = m?.file_type ?? m?.type ?? 'image';
      return url ? `${type}: ${url}` : '';
    })
    .filter(Boolean)
    .join('; ');
}

/** 商品概要表：一行一个商品，含完整媒体信息；含公司ID时便于区分多公司导出 */
export function productsToSummaryRows(products: any[]): (string | number)[][] {
  const header = [
    '商品ID',
    '公司ID',
    '商品名称',
    '分类路径',
    '封面图URL',
    '描述',
    '详情媒体(多)',
    '场景媒体(多)',
    '规格数',
    '上架状态',
    '标签',
    '创建时间',
    '更新时间',
  ];
  const rows: (string | number)[][] = [header];
  for (const p of products) {
    const skuCount = p.product_skus?.length ?? 0;
    const status = p.is_shelved === false ? '已上架' : '已下架';
    rows.push([
      p.id ?? '',
      p._companyId ?? '',
      p.name ?? '',
      getCategoryPath(p.category),
      p.cover_image_url ?? '',
      (p.description ?? '').replace(/\r?\n/g, ' '),
      formatMedias(p.detail_medias),
      formatMedias(p.scene_medias),
      skuCount,
      status,
      p.tags ?? '',
      p.created_at ?? '',
      p.updated_at ?? '',
    ]);
  }
  return rows;
}

/** 规格明细表：一行一个 SKU，含商品信息与规格图片等；含公司ID便于区分多公司导出 */
export function productsToSkuDetailRows(products: any[]): (string | number)[][] {
  const header = [
    '商品ID',
    '公司ID',
    '商品名称',
    '分类路径',
    '规格ID',
    '规格名称',
    '价格',
    '库存',
    '规格上架状态',
    '规格图片URL',
  ];
  const rows: (string | number)[][] = [header];
  for (const p of products) {
    const skus = p.product_skus ?? [];
    const categoryPath = getCategoryPath(p.category);
    if (skus.length === 0) {
      rows.push([p.id ?? '', p._companyId ?? '', p.name ?? '', categoryPath, '', '', '', '', '', '', '']);
      continue;
    }
    for (const sku of skus) {
      const skuStatus = sku.is_shelved === false ? '已上架' : '已下架';
      rows.push([
        p.id ?? '',
        p._companyId ?? '',
        p.name ?? '',
        categoryPath,
        sku.id ?? '',
        sku.name ?? '',
        sku.price ?? '',
        sku.stock ?? '',
        skuStatus,
        sku.image_url ?? '',
      ]);
    }
  }
  return rows;
}

/** 兼容旧用法：将商品列表转为单表 Excel 行（仅概要，无 SKU 明细） */
export function productsToSheetRows(products: any[]): (string | number)[][] {
  return productsToSummaryRows(products);
}

/** 套餐概要表：一行一个套餐；含公司ID便于区分多公司导出 */
export function packagesToSummaryRows(packages: any[]): (string | number)[][] {
  const header = [
    '套餐ID',
    '公司ID',
    '套餐名称',
    '分类路径',
    '封面图URL',
    '描述',
    '包含项数量',
    '上架状态',
    '标签',
    '创建时间',
    '更新时间',
  ];
  const rows: (string | number)[][] = [header];
  for (const p of packages) {
    const itemCount = p.package_product_skus?.length ?? 0;
    const status = p.is_shelved ? '已下架' : '已上架';
    rows.push([
      p.id ?? '',
      p._companyId ?? '',
      p.name ?? '',
      getCategoryPath(p.category),
      p.cover_image_url ?? '',
      (p.description ?? '').replace(/\r?\n/g, ' '),
      itemCount,
      status,
      p.tags ?? '',
      p.created_at ?? '',
      p.updated_at ?? '',
    ]);
  }
  return rows;
}

/** 套餐包含明细表：一行一条包含项（规格级），含所属商品、规格、数量、小计；含公司ID便于区分多公司导出 */
export function packagesToIncludeDetailRows(packages: any[]): (string | number)[][] {
  const header = [
    '套餐ID',
    '公司ID',
    '套餐名称',
    '分类路径',
    '包含项ID',
    '所属商品名称',
    '规格ID',
    '规格名称',
    '规格单价',
    '数量',
    '小计',
  ];
  const rows: (string | number)[][] = [header];
  for (const pkg of packages) {
    const categoryPath = getCategoryPath(pkg.category);
    const items = pkg.package_product_skus ?? [];
    if (items.length === 0) {
      rows.push([
        pkg.id ?? '',
        pkg._companyId ?? '',
        pkg.name ?? '',
        categoryPath,
        '', '', '', '', '', '', '', '',
      ]);
      continue;
    }
    for (const item of items) {
      const sku = item.product_sku;
      const price = Number(sku?.price ?? 0);
      const qty = Number(item.quantity ?? 0);
      const subtotal = price * qty;
      rows.push([
        pkg.id ?? '',
        pkg._companyId ?? '',
        pkg.name ?? '',
        categoryPath,
        item.id ?? '',
        sku?.product?.name ?? '',
        sku?.id ?? '',
        sku?.name ?? '',
        price,
        qty,
        subtotal,
      ]);
    }
  }
  return rows;
}

/** 兼容旧用法：仅套餐概要 */
export function packagesToSheetRows(packages: any[]): (string | number)[][] {
  return packagesToSummaryRows(packages);
}

/**
 * 生成 xlsx 的 ArrayBuffer
 */
export function buildExcelBuffer(
  rows: (string | number)[][],
  sheetName: string
): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/**
 * 生成多 sheet 的 xlsx ArrayBuffer
 */
export function buildExcelBufferSheets(
  sheets: { name: string; rows: (string | number)[][] }[]
): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/**
 * 小程序内：将 Excel 写入本地并打开（用户可转发/保存）
 * 仅微信小程序支持；H5/其他端会提示不支持。
 */
export function openExcelFromBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const toError = (err: any) => new Error(err?.errMsg ?? err?.message ?? '文件写入或打开失败');

    const u = typeof uni !== 'undefined' ? (uni as any) : null;
    const basePath = (u?.env?.USER_DATA_PATH ?? u?.getEnvInfoSync?.()?.USER_DATA_PATH ?? '').trim();
    if (!basePath) {
      reject(new Error('导出仅支持在微信小程序中使用，当前环境无法写入文件'));
      return;
    }
    const filePath = basePath.endsWith('/') ? `${basePath}${fileName}` : `${basePath}/${fileName}`;
    const fs = uni.getFileSystemManager();
    if (!fs) {
      reject(new Error('当前环境不支持文件写入'));
      return;
    }
    fs.writeFile({
      filePath,
      data: buffer,
      encoding: 'binary',
      success: () => {
        uni.openDocument({
          filePath,
          fileType: 'xlsx',
          showMenu: true,
          success: () => resolve(),
          fail: (err) => reject(toError(err)),
        });
      },
      fail: (err) => reject(toError(err)),
    });
  });
}

/**
 * 导出商品列表为 Excel 并打开（含规格明细 + 商品概要 + 媒体信息）
 */
export async function exportProductsToExcel(products: any[]): Promise<void> {
  const skuRows = productsToSkuDetailRows(products);
  const summaryRows = productsToSummaryRows(products);
  const buffer = buildExcelBufferSheets([
    { name: '规格明细', rows: skuRows },
    { name: '商品列表', rows: summaryRows },
  ]);
  const name = `商品导出_${Date.now()}.xlsx`;
  await openExcelFromBuffer(buffer, name);
}

/**
 * 导出套餐列表为 Excel 并打开（含套餐包含规格明细 + 套餐概要）
 */
export async function exportPackagesToExcel(packages: any[]): Promise<void> {
  const detailRows = packagesToIncludeDetailRows(packages);
  const summaryRows = packagesToSummaryRows(packages);
  const buffer = buildExcelBufferSheets([
    { name: '套餐包含明细', rows: detailRows },
    { name: '套餐列表', rows: summaryRows },
  ]);
  const name = `套餐导出_${Date.now()}.xlsx`;
  await openExcelFromBuffer(buffer, name);
}
