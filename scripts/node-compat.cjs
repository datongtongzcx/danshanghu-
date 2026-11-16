/**
 * Node 兼容补丁（构建前预加载）
 *
 * vue2 版 uni-app 的构建链（webpack 4 / @vue/cli-service 4 / postcss-urlrewrite 等）
 * 依赖一批早已废弃的 Node API：
 *   - util.isRegExp / util.isDate 等（Node 23+ 已移除）
 *   - crypto 的 md4 摘要算法（Node 17+ 默认关闭，需 --openssl-legacy-provider）
 *
 * 本项目 engines 建议使用 Node 18；若本机只能是更高版本 Node，
 * 通过 `node --require ./scripts/node-compat.cjs ...` 预加载本文件即可恢复这些 API。
 */
'use strict';

const util = require('util');

const shims = {
    isArray: Array.isArray,
    isBoolean: (v) => typeof v === 'boolean',
    isBuffer: Buffer.isBuffer,
    isDate: (v) => v instanceof Date && !isNaN(v.getTime()),
    isError: (v) => v instanceof Error,
    isFunction: (v) => typeof v === 'function',
    isNull: (v) => v === null,
    isNullOrUndefined: (v) => v === null || v === undefined,
    isNumber: (v) => typeof v === 'number',
    isObject: (v) => v !== null && typeof v === 'object',
    isPrimitive: (v) => v === null || (typeof v !== 'object' && typeof v !== 'function'),
    isRegExp: (v) => v instanceof RegExp,
    isString: (v) => typeof v === 'string',
    isSymbol: (v) => typeof v === 'symbol',
    isUndefined: (v) => v === undefined
};

for (const name of Object.keys(shims)) {
    if (typeof util[name] !== 'function') {
        try {
            Object.defineProperty(util, name, {
                value: shims[name],
                writable: true,
                configurable: true,
                enumerable: false
            });
        } catch (e) {
            // 忽略个别无法定义的场景，避免影响构建启动
        }
    }
}

if (typeof util._extend !== 'function') {
    util._extend = function (target, source) {
        if (source) {
            for (const key of Object.keys(source)) {
                target[key] = source[key];
            }
        }
        return target;
    };
}

// uni-app 自带打过补丁的 @vue/component-compiler-utils 会输出
// recyclableRender / components 变量；npm 提升的官方版不会，
// 导致 H5 / APP 编译时所有模板报 “Export 'recyclableRender' is not defined”。
// 这里把模板加载器的 require 指向 uni 自带的补丁版。
try {
    const path = require('path');
    const fs = require('fs');
    const bundled = path.resolve(
        __dirname,
        '../node_modules/@dcloudio/vue-cli-plugin-uni/packages/@vue/component-compiler-utils'
    );
    if (fs.existsSync(bundled)) {
        require('module-alias').addAlias('@vue/component-compiler-utils', bundled);
    }
} catch (e) {
    // 兼容环境里没有 module-alias 的情况
}
