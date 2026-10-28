/**
 * 微信小程序上传（npm run upload:mp-weixin）
 *
 * 前置条件：
 * 1. 已执行 npm run build:mp-weixin，产物位于 dist/build/mp-weixin
 * 2. 在微信公众平台「开发管理 - 开发设置 - 小程序代码上传」下载上传密钥
 * 3. 将密钥内容写入 GitHub Secret: WX_UPLOAD_PRIVATE_KEY（或本地环境变量）
 * 4. 同页面的 IP 白名单需允许 GitHub Actions 出口 IP（或关闭白名单校验）
 *
 * 环境变量：
 * - WX_UPLOAD_PRIVATE_KEY  上传密钥 PEM 内容（base64 编码或原文均可）
 * - WX_UPLOAD_APPID        可选，默认读取 manifest.json 的 mp-weixin.appid
 * - WX_UPLOAD_VERSION      可选，默认 package.json version
 * - WX_UPLOAD_ROBOT        可选，机器人编号 1-30，默认 1
 */
const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const ROOT = path.resolve(__dirname, '..');
const projectPath = path.join(ROOT, 'dist/build/mp-weixin');

function getAppid() {
    if (process.env.WX_UPLOAD_APPID) return process.env.WX_UPLOAD_APPID;
    const manifest = fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8');
    const match = manifest.match(/"mp-weixin"[\s\S]*?"appid"\s*:\s*"([^"]+)"/);
    if (!match) throw new Error('未在 manifest.json 中找到 mp-weixin.appid');
    return match[1];
}

function writePrivateKey() {
    const raw = process.env.WX_UPLOAD_PRIVATE_KEY;
    if (!raw) {
        throw new Error('缺少 WX_UPLOAD_PRIVATE_KEY 环境变量（微信公众平台下载的上传密钥内容）');
    }
    const keyPath = path.join(ROOT, '.tmp-private-key.pem');
    let content = raw;
    try {
        // 兼容以 base64 形式配置的密钥
        const decoded = Buffer.from(raw, 'base64');
        if (decoded.toString('utf8').includes('PRIVATE KEY')) content = decoded.toString('utf8');
    } catch (e) {}
    fs.writeFileSync(keyPath, content.endsWith('\n') ? content : content + '\n');
    return keyPath;
}

(async () => {
    if (!fs.existsSync(path.join(projectPath, 'app.json'))) {
        throw new Error(`未找到编译产物 ${projectPath}，请先执行 npm run build:mp-weixin`);
    }

    const pkg = require(path.join(ROOT, 'package.json'));
    const version = process.env.WX_UPLOAD_VERSION || pkg.version;
    const robot = Number(process.env.WX_UPLOAD_ROBOT || 1);
    const keyPath = writePrivateKey();

    try {
        const project = new ci.Project({
            appid: getAppid(),
            type: 'miniProgram',
            projectPath,
            privateKeyPath: keyPath,
            ignores: ['node_modules/**/*']
        });

        const result = await ci.upload({
            project,
            version,
            desc: `CI 自动上传 ${new Date().toISOString()}`,
            setting: {
                es6: true,
                minified: true,
                autoPrefixWXSS: true
            },
            robot
        });
        console.log('上传成功:', JSON.stringify(result || {}));
    } finally {
        fs.rmSync(keyPath, { force: true });
    }
})().catch(err => {
    console.error('上传失败:', err.message);
    process.exit(1);
});
