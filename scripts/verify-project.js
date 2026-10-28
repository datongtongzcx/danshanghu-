/**
 * 轻量静态校验（npm run verify）
 * 用于 CI 快速反馈，不依赖 HBuilderX：
 * 1. pages.json / manifest.json 语法（支持注释、尾逗号）
 * 2. 页面路径与 tabBar 配置对应的 vue 文件是否存在
 * 3. 全部 .vue 单文件组件结构完整性
 * 4. 主题资源一致性（theme.css / static/images / App.vue default_theme）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];

function fail(msg) {
    errors.push(msg);
}

function stripJsonc(text) {
    let out = '';
    let i = 0;
    let inString = false;
    let quote = '';
    while (i < text.length) {
        const ch = text[i];
        if (inString) {
            out += ch;
            if (ch === '\\') {
                out += text[i + 1] || '';
                i += 2;
                continue;
            }
            if (ch === quote) inString = false;
            i++;
            continue;
        }
        if (ch === '"' || ch === "'") {
            inString = true;
            quote = ch;
            out += ch;
            i++;
            continue;
        }
        if (ch === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            continue;
        }
        if (ch === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        out += ch;
        i++;
    }
    // 去掉尾逗号
    let prev;
    do {
        prev = out;
        out = out.replace(/,(\s*[}\]])/g, '$1');
    } while (out !== prev);
    return out;
}

function readJsonc(file) {
    try {
        return JSON.parse(stripJsonc(fs.readFileSync(file, 'utf8')));
    } catch (e) {
        fail(`${file} 解析失败: ${e.message}`);
        return null;
    }
}

// 1. 配置文件
const pagesJson = readJsonc(path.join(ROOT, 'pages.json')) || { pages: [] };
const manifestJson = readJsonc(path.join(ROOT, 'manifest.json'));

if (manifestJson && !(manifestJson['mp-weixin'] || {}).appid) {
    fail('manifest.json 缺少 mp-weixin.appid，无法上传小程序');
}

// 2. 页面文件
const pagePaths = (pagesJson.pages || []).map(p => p.path);
for (const sub of pagesJson.subPackages || []) {
    for (const p of sub.pages || []) pagePaths.push(`${sub.root}/${p.path}`);
}
if (pagePaths.length === 0) fail('pages.json 未配置任何页面');
for (const p of pagePaths) {
    if (!fs.existsSync(path.join(ROOT, `${p}.vue`))) fail(`页面文件不存在: ${p}.vue`);
}

const pageSet = new Set(pagePaths);
for (const item of (pagesJson.tabBar && pagesJson.tabBar.list) || []) {
    if (!pageSet.has(item.pagePath)) fail(`tabBar.pagePath 不在 pages 中: ${item.pagePath}`);
}

// 3. vue 单文件组件结构
function walkVue(dir, list) {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === 'uni_modules' || name === 'unpackage' || name === 'dist') continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walkVue(full, list);
        else if (name.endsWith('.vue')) list.push(full);
    }
}
const vueFiles = [path.join(ROOT, 'App.vue')];
for (const root of ['pages', 'components']) walkVue(path.join(ROOT, root), vueFiles);
for (const file of vueFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    for (const tag of ['template', 'script']) {
        const open = new RegExp(`<${tag}[\\s>]`, 'i');
        const close = new RegExp(`</${tag}\\s*>`, 'i');
        if (open.test(content) !== close.test(content)) fail(`${rel} 的 <${tag}> 标签不配对`);
    }
}

// 4. 主题资源一致性
const themeCss = fs.readFileSync(path.join(ROOT, 'common/css/theme.css'), 'utf8');
const appVue = fs.readFileSync(path.join(ROOT, 'App.vue'), 'utf8');
const themes = fs.readdirSync(path.join(ROOT, 'static/images')).filter(name => name !== 'common');
for (const theme of themes) {
    if (!themeCss.includes(`.theme-${theme} `)) fail(`common/css/theme.css 缺少 .theme-${theme} 样式`);
    for (const icon of ['home', 'category', 'cart', 'user']) {
        const iconPath = path.join(ROOT, `static/images/${theme}/tabbar/${icon}.png`);
        if (!fs.existsSync(iconPath)) fail(`tabbar 图标缺失: static/images/${theme}/tabbar/${icon}.png`);
    }
}
const themeMatch = appVue.match(/default_theme:\s*'([^']+)'/);
if (!themeMatch) {
    fail('App.vue 未找到 default_theme 配置');
} else if (!themes.includes(themeMatch[1])) {
    fail(`App.vue default_theme "${themeMatch[1]}" 在 static/images 下无对应主题资源`);
}

if (errors.length) {
    console.error(`校验失败，共 ${errors.length} 处问题：`);
    errors.forEach(e => console.error(' - ' + e));
    process.exit(1);
}
console.log(`校验通过：${pagePaths.length} 个页面、${vueFiles.length} 个 vue 文件、${themes.length} 套主题资源。`);
