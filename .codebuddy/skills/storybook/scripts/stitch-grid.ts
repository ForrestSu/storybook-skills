/**
 * 绘本网格拼接脚本
 * 将一本绘本的所有页面图片按网格方式拼接（每行N张，水平铺开后换行），方便预览和对比。
 *
 * 用法:
 *   bun scripts/stitch-grid.ts <book-dir>
 *   bun scripts/stitch-grid.ts <book-dir> --cols 4 --gap 5
 *   bun scripts/stitch-grid.ts <book-dir> --cols 3 --gap 10 --no-open
 *
 * 参数:
 *   --cols <n>     每行图片数量，默认 4
 *   --gap <px>     图片之间的间距（像素），默认 5
 *   --no-open      不自动打开生成的图片
 *
 * 输出: <book-dir>/all-pages-grid.jpeg
 */

import path from "node:path";
import { readdir, access } from "node:fs/promises";
import { execSync } from "node:child_process";
import sharp from "sharp";

// ---------------------------------------------------------------------------
// 收集页面图片
// ---------------------------------------------------------------------------

/**
 * 在书目录中找到所有页面图片，按自然顺序排序。
 * 匹配: 00-cover.jpeg, 01-page.jpeg, ..., NN-page.jpeg
 * 同时兼容 .jpeg / .jpg / .png 扩展名。
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
// 网格拼接
// ---------------------------------------------------------------------------

async function stitchGrid(
  imagePaths: string[],
  outputPath: string,
  cols: number,
  gap: number
): Promise<void> {
  if (imagePaths.length === 0) {
    throw new Error("No page images found in directory");
  }

  // 读取所有图片的元数据获取尺寸
  const metas = await Promise.all(
    imagePaths.map(async (p) => {
      const meta = await sharp(p).metadata();
      return { path: p, width: meta.width!, height: meta.height! };
    })
  );

  // 把图片分成若干行
  const rows: (typeof metas)[] = [];
  for (let i = 0; i < metas.length; i += cols) {
    rows.push(metas.slice(i, i + cols));
  }

  // 计算每个单元格的统一尺寸：
  // 先取所有图片中最大宽度，再按列数和间距计算每个单元格宽度
  // 这里采用等宽策略：所有图片缩放到相同宽度，高度等比缩放后取该行最大高度
  const maxOrigWidth = Math.max(...metas.map((m) => m.width));

  // 单元格宽度 = 所有图中最大宽度（保持原始分辨率感）
  // 但如果图片太大，可以限制一下。这里直接用原始最大宽度。
  const cellWidth = maxOrigWidth;

  // 计算每行的行高（该行中所有图片等比缩放到 cellWidth 后的最大高度）
  const rowHeights = rows.map((row) =>
    Math.max(
      ...row.map((m) => Math.round((m.height / m.width) * cellWidth))
    )
  );

  // 计算画布总尺寸
  const totalWidth = cellWidth * cols + gap * (cols - 1);
  const totalHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + gap * (rows.length - 1);

  console.log(
    `Stitching ${imagePaths.length} images in ${rows.length} rows × ${cols} cols → ${totalWidth}×${totalHeight}px (gap: ${gap}px)`
  );

  // 构建 composite 操作列表
  const composites: { input: Buffer; top: number; left: number }[] = [];
  let currentY = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowHeight = rowHeights[r];

    for (let c = 0; c < row.length; c++) {
      const m = row[c];
      const scaledHeight = Math.round((m.height / m.width) * cellWidth);

      const resized = await sharp(m.path)
        .resize({ width: cellWidth, height: scaledHeight, fit: "fill" })
        .toBuffer();

      const left = c * (cellWidth + gap);
      // 垂直居中对齐（如果该图比行高矮，居中放置）
      const top = currentY + Math.round((rowHeight - scaledHeight) / 2);

      composites.push({ input: resized, top, left });
    }

    currentY += rowHeight + gap;
  }

  // 创建画布并合成
  await sharp({
    create: {
      width: totalWidth,
      height: totalHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  console.log(`Saved: ${outputPath}`);
}

// ---------------------------------------------------------------------------
// CLI 参数解析
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  let cols = 4;
  let gap = 5;
  let noOpen = false;
  let bookDir: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cols" && argv[i + 1]) {
      cols = parseInt(argv[++i], 10);
      if (isNaN(cols) || cols < 1) {
        console.error("Error: --cols must be a positive integer");
        process.exit(1);
      }
    } else if (arg === "--gap" && argv[i + 1]) {
      gap = parseInt(argv[++i], 10);
      if (isNaN(gap) || gap < 0) {
        console.error("Error: --gap must be a non-negative integer");
        process.exit(1);
      }
    } else if (arg === "--no-open") {
      noOpen = true;
    } else if (!arg.startsWith("-")) {
      bookDir = arg;
    }
  }

  return { cols, gap, noOpen, bookDir };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage:
  bun stitch-grid.ts <book-directory> [options]

Combines all page images (00-cover through NN-page) into a grid layout
image saved as all-pages-grid.jpeg in the book directory.

Options:
  --cols <n>     Number of images per row (default: 4)
  --gap <px>     Gap between images in pixels (default: 5)
  --no-open      Do not auto-open the result image

Examples:
  bun stitch-grid.ts ./my-book
  bun stitch-grid.ts ./my-book --cols 3 --gap 10
  bun stitch-grid.ts ./my-book --cols 6 --gap 0 --no-open`);
    return;
  }

  const { cols, gap, noOpen, bookDir: rawDir } = parseArgs(argv);

  if (!rawDir) {
    console.error("Error: please provide a book directory");
    process.exitCode = 1;
    return;
  }

  const bookDir = path.resolve(rawDir);

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

  console.log(`Found ${images.length} page images:`);
  for (const img of images) {
    console.log(`  ${path.basename(img)}`);
  }

  const outputPath = path.join(bookDir, "all-pages-grid.jpeg");
  await stitchGrid(images, outputPath, cols, gap);

  // 自动预览
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
