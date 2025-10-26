#!/usr/bin/env node
/**
 * SVG to PNG 批量转换脚本 (Node.js版本) 
 * 将SVG文件转换为PNG格式，生成两种颜色版本：
 * 1. 默认颜色 #999999
 * 2. 激活状态颜色 #667eea (文件名加-active后缀)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色配置
const DEFAULT_COLOR = '#999999';
const ACTIVE_COLOR = '#667eea';
const PNG_SIZE = 64;

/**
 * 安装必要的npm包
 */
function installRequiredPackages() {
    try {
        require('sharp');
        console.log('sharp 已安装');
    } catch (error) {
        console.log('正在安装 sharp...');
        try {
            execSync('npm install sharp', { stdio: 'inherit' });
        } catch (installError) {
            console.error('安装 sharp 失败，尝试使用全局安装...');
            try {
                execSync('npm install -g sharp', { stdio: 'inherit' });
            } catch (globalError) {
                console.error('无法安装 sharp，将使用备用方法');
                return false;
            }
        }
    }
    return true;
}

/**
 * 修改SVG内容的颜色
 */
function changeSvgColor(svgContent, newColor) {
    let modifiedContent = svgContent;
    
    // 替换常见的颜色属性
    const patterns = [
        [/fill="[^"]*"/g, `fill="${newColor}"`],
        [/stroke="[^"]*"/g, `stroke="${newColor}"`],
        [/fill:[^;]*;/g, `fill:${newColor};`],
        [/stroke:[^;]*;/g, `stroke:${newColor};`],
        [/fill:#[0-9a-fA-F]{6}/g, `fill:${newColor}`],
        [/stroke:#[0-9a-fA-F]{6}/g, `stroke:${newColor}`],
        [/fill:#[0-9a-fA-F]{3}/g, `fill:${newColor}`],
        [/stroke:#[0-9a-fA-F]{3}/g, `stroke:${newColor}`],
    ];
    
    patterns.forEach(([pattern, replacement]) => {
        modifiedContent = modifiedContent.replace(pattern, replacement);
    });
    
    // 如果没有找到颜色属性，在svg标签中添加fill属性
    if (!modifiedContent.includes('fill=') && !modifiedContent.includes('stroke=')) {
        modifiedContent = modifiedContent.replace(
            /<svg([^>]*)>/,
            `<svg$1 fill="${newColor}">`
        );
    }
    
    return modifiedContent;
}

/**
 * 使用Sharp将SVG转换为PNG
 */
async function convertSvgToPngWithSharp(svgContent, outputPath, size = PNG_SIZE) {
    try {
        const sharp = require('sharp');
        
        const buffer = Buffer.from(svgContent, 'utf-8');
        await sharp(buffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        
        return true;
    } catch (error) {
        console.error(`Sharp转换失败: ${error.message}`);
        return false;
    }
}

/**
 * 备用方法：创建HTML文件并使用浏览器截图（简化版）
 */
function createSimplePngFromSvg(svgContent, outputPath, color) {
    try {
        // 创建一个简单的SVG文件，然后手动转换
        const tempSvgPath = outputPath.replace('.png', '_temp.svg');
        const coloredSvg = changeSvgColor(svgContent, color);
        
        fs.writeFileSync(tempSvgPath, coloredSvg);
        console.log(`  创建了临时SVG文件: ${path.basename(tempSvgPath)}`);
        console.log(`  请手动将 ${path.basename(tempSvgPath)} 转换为 ${path.basename(outputPath)}`);
        
        return true;
    } catch (error) {
        console.error(`备用方法失败: ${error.message}`);
        return false;
    }
}

/**
 * 转换单个SVG文件
 */
async function convertSvgFile(svgFilePath, outputDir) {
    const fileName = path.basename(svgFilePath, '.svg');
    const svgContent = fs.readFileSync(svgFilePath, 'utf-8');
    
    console.log(`正在处理: ${path.basename(svgFilePath)}`);
    
    let successCount = 0;
    
    // 生成默认颜色版本
    const defaultPngPath = path.join(outputDir, `${fileName}.png`);
    const defaultColoredSvg = changeSvgColor(svgContent, DEFAULT_COLOR);
    
    try {
        if (await convertSvgToPngWithSharp(defaultColoredSvg, defaultPngPath)) {
            console.log(`  ✓ 生成默认版本: ${fileName}.png`);
            successCount++;
        } else {
            // 使用备用方法
            if (createSimplePngFromSvg(svgContent, defaultPngPath, DEFAULT_COLOR)) {
                successCount++;
            }
        }
    } catch (error) {
        console.log(`  ✗ 默认版本转换失败: ${error.message}`);
    }
    
    // 生成激活状态版本
    const activePngPath = path.join(outputDir, `${fileName}-active.png`);
    const activeColoredSvg = changeSvgColor(svgContent, ACTIVE_COLOR);
    
    try {
        if (await convertSvgToPngWithSharp(activeColoredSvg, activePngPath)) {
            console.log(`  ✓ 生成激活版本: ${fileName}-active.png`);
            successCount++;
        } else {
            // 使用备用方法
            if (createSimplePngFromSvg(svgContent, activePngPath, ACTIVE_COLOR)) {
                successCount++;
            }
        }
    } catch (error) {
        console.log(`  ✗ 激活版本转换失败: ${error.message}`);
    }
    
    return successCount;
}

/**
 * 主函数
 */
async function main() {
    console.log('开始SVG到PNG的批量转换...');
    
    const currentDir = __dirname;
    const svgFiles = fs.readdirSync(currentDir)
        .filter(file => file.endsWith('.svg'))
        .map(file => path.join(currentDir, file));
    
    console.log(`找到 ${svgFiles.length} 个SVG文件`);
    
    // 尝试安装Sharp
    const hasSharp = installRequiredPackages();
    if (!hasSharp) {
        console.log('将使用备用方法创建临时SVG文件');
    }
    
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (const svgFile of svgFiles) {
        try {
            const successCount = await convertSvgFile(svgFile, currentDir);
            totalSuccess += successCount;
            if (successCount < 2) {
                totalFailed += (2 - successCount);
            }
        } catch (error) {
            console.error(`处理文件失败 ${path.basename(svgFile)}: ${error.message}`);
            totalFailed += 2;
        }
    }
    
    console.log('\n转换完成!');
    console.log(`总SVG文件数: ${svgFiles.length}`);
    console.log(`成功转换: ${totalSuccess} 个PNG文件`);
    console.log(`转换失败: ${totalFailed} 个文件`);
    
    if (!hasSharp) {
        console.log('\n注意: 由于无法安装Sharp，已创建临时SVG文件。');
        console.log('您可以使用在线工具或其他软件将这些SVG文件转换为PNG。');
    }
}

// 运行主函数
main().catch(console.error);
