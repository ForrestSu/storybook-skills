/**
 * 绘本长图拼接脚本
 * 将一本绘本的所有页面图片按顺序垂直拼接成一张长图，方便预览和分享。
 *
 * 用法:
 *   bun scripts/stitch-pages.ts <book-dir>
 *   bun scripts/stitch-pages.ts <book-dir> --no-open
 *
 * 输出: <book-dir>/all-pages.jpeg
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
 * 同时兼容 .jpeg 和 .png 扩展名。
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
// 拼接
// ---------------------------------------------------------------------------

async function stitchImages(
  imagePaths: string[],
  outputPath: string
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

  // 统一宽度为最大宽度，等比缩放
  const maxWidth = Math.max(...metas.map((m) => m.width));

  // 计算每张图缩放后的高度和总高度
  const scaledHeights = metas.map((m) =>
    Math.round((m.height / m.width) * maxWidth)
  );
  const totalHeight = scaledHeights.reduce((sum, h) => sum + h, 0);

  console.log(
    `Stitching ${imagePaths.length} images → ${maxWidth}x${totalHeight}px`
  );

  // 构建 composite 操作列表
  const composites: { input: Buffer; top: number; left: number }[] = [];
  let currentY = 0;

  for (let i = 0; i < imagePaths.length; i++) {
    const resized = await sharp(imagePaths[i])
      .resize({ width: maxWidth, height: scaledHeights[i], fit: "fill" })
      .toBuffer();

    composites.push({ input: resized, top: currentY, left: 0 });
    currentY += scaledHeights[i];
  }

  // 创建画布并合成
  await sharp({
    create: {
      width: maxWidth,
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
// CLI
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    console.log(`Usage:
  bun stitch-pages.ts <book-directory> [--no-open]

Combines all page images (00-cover through NN-page) into a single
vertical strip image saved as all-pages.jpeg in the book directory.

Options:
  --no-open    Do not auto-open the result image`);
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

  console.log(`Found ${images.length} page images:`);
  for (const img of images) {
    console.log(`  ${path.basename(img)}`);
  }

  const outputPath = path.join(bookDir, "all-pages.jpeg");
  await stitchImages(images, outputPath);

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
