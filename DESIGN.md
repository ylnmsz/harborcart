# HarborCart UI

商品浏览与任务导向后台使用同一套排版和控件。白色主背景，铜橙色行动按钮，深青色公告栏；商品插画承担视觉表达，后台将空间留给订单与库存。

## Tokens

颜色以 `frontend/src/style.css` 中的 OKLCH 变量为准：bg 1/0/0、surface .97/.004/70、ink .23/.016/55、muted .46/.014/55、primary .51/.145/45、accent .29/.065/195。

正文使用 Segoe UI / Microsoft YaHei 系统字体，商城英文主题标题使用 Georgia。控件统一 5px 圆角，44px 左右操作高度；标签、加载状态、错误和成功提示具有一致语义。

## Layout

桌面商城三列商品，手机两列；购物车结算从两列变为一列；运营表格保留独立横向滚动容器。详情使用浏览器原生 dialog，支持 Escape 关闭和焦点约束。可见键盘焦点，尊重减少动画设置。

六张自带 SVG 商品插画放在 public/images，不依赖外部图片链接。
