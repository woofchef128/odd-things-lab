# Zentio Enterprise 网店测试版

Netlify 项目根目录是解压后的目录。通过 Git 导入或用 Netlify CLI 构建部署，以便一并部署 Functions。后台页面是 /admin.html，在 Netlify 设置 Functions 可读取的 ZENTIO_ADMIN_KEY，值使用独立的高强度随机密码。

测试商品和状态在 public/catalog.json。测试订单存储在 Netlify Blobs，保留订单号和私密查询链接即可跨设备查看。后台拿到订单号后可以更新进度。正式开启前，录入实际商品图、价格和付款说明，并决定收件及运费流程。确认线上联调结果后才把 live 改成 true。现有的测试订单始终保留测试标识。

品牌：有东西研究所 · Odd Things Lab。

正式模式请把 QR 图片放入 public，再填 catalog.json 的 payment.qrImage（站内路径）；同时填写 bankName、accountName、accountNumber。顾客提交邮寄资料并选择 QR 或 Bank In。付款后可通过保存的查询链接回来填写付款人姓名，生成带商品、数量、金额、邮寄资料和订单号的 WhatsApp 讯息。测试模式只预览讯息。WhatsApp 讯息和收据由顾客发送，店主在后台手动确认及更新状态。
Odd Things Lab deployment test.
