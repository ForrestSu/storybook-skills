/**
 * 绘本 PDF 生成脚本
 * 将一本绘本的所有页面图片按顺序逐页嵌入 PDF，每张图片占一整页。
 *
 * 用法:
 *   bun scripts/stitch-pdf.ts <book-dir>
 *   bun scripts/stitch-pdf.ts <book-dir> --no-open
 *
 * 输出: <book-dir>/all-pages.pdf
 */

import path from "node:path";
import { readdir, access, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

// ---------------------------------------------------------------------------
// 收集页面图片
// ---------------------------------------------------------------------------

/**
 * 在书目录中找到所有页面图片，按自然顺序排序。
 * 匹配: 00-cover.jpeg, 01-page.jpeg, ..., NN-page.jpeg
 * 同时兼容 .jpeg、.jpg 和 .png 扩展名。
 */
async function collectPageImages(bookDir: string): Promise<string[]> {
  const entries = await readdir(bookDir);

  const pagePattern = /^(\d{2})-(cover|page)\.(jpeg|jpg|png)$/;
  const matched = entries
    .filter((f) => pagePattern.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.slice(0, 2), 10);
      const numB = parseInt(b.slice(0, 2), 10);
      return numA - numB;
    });

  return matched.map((f) => path.join(bookDir, f));
}

// ---------------------------------------------------------------------------
// 图片转 PDF
// ---------------------------------------------------------------------------

async function imagesToPdf(
  imagePaths: string[],
  outputPath: string
): Promise<void> {
  if (imagePaths.length === 0) {
    throw new Error("No page images found in directory");
  }

  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < imagePaths.length; i++) {
    const imgPath = imagePaths[i];
    const ext = path.extname(imgPath).toLowerCase();

    // 读取图片元数据获取原始尺寸
    const meta = await sharp(imgPath).metadata();
    const imgWidth = meta.width!;
    const imgHeight = meta.height!;

    // 根据原始格式选择嵌入方式，避免不必要的转码
    let pdfImage;
    if (ext === ".png") {
      const pngBuffer = await sharp(imgPath).png().toBuffer();
      pdfImage = await pdfDoc.embedPng(pngBuffer);
    } else {
      // jpeg / jpg 直接用 embedJpg
      const jpgBuffer = await sharp(imgPath).jpeg({ quality: 95 }).toBuffer();
      pdfImage = await pdfDoc.embedJpg(jpgBuffer);
    }

    // 添加页面，尺寸匹配图片原始像素尺寸
    const page = pdfDoc.addPage([imgWidth, imgHeight]);
    page.drawImage(pdfImage, {
      x: 0,
      y: 0,
      width: imgWidth,
      height: imgHeight,
    });

    console.log(
      `  [${i + 1}/${imagePaths.length}] ${path.basename(imgPath)} → ${imgWidth}x${imgHeight}`
    );
  }

  const pdfBytes = await pdfDoc.save();
  await writeFile(outputPath, pdfBytes);

  console.log(`Saved: ${outputPath} (${imagePaths.length} pages)`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage:
  bun stitch-pdf.ts <book-directory> [--no-open]

Converts all page images (00-cover through NN-page) into a multi-page
PDF file saved as all-pages.pdf in the book directory.

Options:
  --no-open    Do not auto-open the result PDF`);
    return;
  }

  const noOpen = argv.includes("--no-open");
  const bookDir = path.resolve(argv.find((a) => !a.startsWith("-"))!);

  // 验证目录存在
  try {
    await access(bookDir);
  } catch {
    console.error(`Error: directory not found: ${bookDir}`);
    process.exitCode = 1;
    return;
  }

  const images = await collectPageImages(bookDir);
  if (images.length === 0) {
    console.error(
      `Error: no page images found in ${bookDir} (expected 00-cover.jpeg, 01-page.jpeg, ...)`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Found ${images.length} page images, generating PDF...`);
  for (const img of images) {
    console.log(`  ${path.basename(img)}`);
  }

  const outputPath = path.join(bookDir, "all-pages.pdf");
  await imagesToPdf(images, outputPath);

  // 自动打开
  if (!noOpen) {
    try {
      const platform = process.platform;
      if (platform === "darwin") execSync(`open "${outputPath}"`);
      else if (platform === "linux")
        execSync(`xdg-open "${outputPath}" 2>/dev/null || true`);
      else if (platform === "win32") execSync(`start "" "${outputPath}"`);
    } catch {
      // ignore
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
