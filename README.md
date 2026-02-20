![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Loukky/website-ip-show?utm_source=oss&utm_medium=github&utm_campaign=Loukky%2Fwebsite-ip-show&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)  
Website IP Show  
一个简洁的 Chrome 扩展程序，用于实时显示当前网站的服务器 IP 归属地、CDN 解析组及网络详细信息。  
  
### ✨ 主要功能  
实时图标：在浏览器栏直接显示当前 IP 所属国家的国旗。  
  
双路检测：同时展示浏览器连接 IP（Browser Side）与 域名解析 IP 组（Server Side）。  
  
智能去重：自动隐藏当前连接中的 IP，在 CDN 环境下方便查看其他节点。  
  
详细数据：包括 国家、城市、ISP、ASN 以及 开放端口。  
  
自愈机制：内置重试逻辑，确保在网络波动时自动恢复数据加载。  
  
### 🛠️ 安装方法  
下载项目代码并解压。  
  
打开 Chrome chrome://extensions/。  
  
开启 开发者模式。
  
点击 加载已解压的扩展程序，选择项目文件夹。  
  
### 🖱️ 交互说明  
点击左侧列表：切换并查看不同服务器 IP 的地理位置详情。  
  
代理模式：当使用代理（显示 ::1 或 127.0.0.1）时，Server Side 列表将完整展示。  
  
### 📡 API 支持
IP数据来自于互联网。  
  
📄 开源协议  
MIT License  
