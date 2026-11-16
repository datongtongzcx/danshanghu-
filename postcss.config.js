// PostCSS 配置（uni-app / Vue CLI 标准默认配置）
// 注意：当前构建链使用的是 PostCSS 7（@vue/cli-service 4.x），
// 因此 autoprefixer 固定使用 9.x 版本，切勿升级到 10（10 需要 PostCSS 8）
module.exports = {
    plugins: [
        require('autoprefixer')({
            remove: false
        })
    ]
};
