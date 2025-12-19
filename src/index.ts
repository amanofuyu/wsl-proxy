import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'

dotenv.config()

const app = express()
const listenPort = 5566
const proxyPort = 3344

// 中间件
app.use(cors())
app.use(express.json())

// 代理设置
app.use('/', createProxyMiddleware({
  target: `http://localhost:${proxyPort}`,
  changeOrigin: false,
  ws: true,
}))

// 启动服务器
app.listen(listenPort, () => {
  console.log(`Proxy server is running on port ${listenPort}`)
  console.log(`Forwarding requests to port ${proxyPort}`)
})
