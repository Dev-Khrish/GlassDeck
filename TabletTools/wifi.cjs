const http = require('node:http')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const data = path.join(process.env.LOCALAPPDATA,'GlassDeck')
fs.mkdirSync(data,{recursive:true})
const pairFile = path.join(data,'wifi-pair.json')
const addresses = () => Object.values(os.networkInterfaces()).flat().filter(n=>n.family==='IPv4' && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map(n=>n.address)
if(process.argv.includes('--pair')){
  const code = String(crypto.randomInt(100000,1000000))
  fs.writeFileSync(pairFile,JSON.stringify({code,expires:Date.now()+300000}))
  console.log('Windows address:',addresses().map(ip=>ip+':38423').join(' or '),'  Pairing code:',code)
  process.exit()
}
const tokenFile = path.join(data,'wifi-session')
const attempts = new Map()
http.createServer((req,res)=>{
  const send = (status,body='',headers={})=>{res.writeHead(status,{'Cache-Control':'no-store',...headers});res.end(body)}
  if(!addresses().concat('127.0.0.1').some(ip=>req.headers.host===ip+':38423') || !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(req.socket.remoteAddress))return send(403)
  if(req.method==='GET' && req.url==='/install.apk'){
    res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':'attachment; filename="GlassDeck.apk"'})
    return fs.createReadStream(path.join(__dirname,'../GlassDeck Display.apk')).on('error',()=>res.destroy()).pipe(res)
  }
  const route=(req.url||'').split('?')[0]
  if(['/api/profile','/api/spotify'].includes(route) && (req.method==='GET'||req.method==='POST')){
    if(req.method==='POST' && req.headers.origin!=='http://'+req.headers.host)return send(403)
    const proxy=http.request({hostname:'127.0.0.1',port:38422,path:req.url,method:req.method,headers:{Origin:'http://127.0.0.1:38422'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)})
    proxy.on('error',()=>send(503));if(route==='/api/profile' && req.method==='POST')req.pipe(proxy);else proxy.end();return
  }
  if(req.method!=='GET' || !(/^\/_next\/static\/[\w./%~-]+$/.test(route) && !/\.\.|%2e/i.test(route) || ['/tablet','/api/tablet-health','/icon.svg','/icon-light-32x32.png','/icon-dark-32x32.png'].includes(route)))return send(404)
  const upstream=http.get({hostname:'127.0.0.1',port:38422,path:req.url},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res)})
  upstream.on('error',()=>send(503))
}).listen(38423,'0.0.0.0')
