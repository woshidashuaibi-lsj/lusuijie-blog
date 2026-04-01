/**
 * 阿里云函数计算 FC 3.0 HTTP 触发器入口
 * 使用 @webserverless/fc-express 官方适配器
 */

const proxy = require('@webserverless/fc-express');
const { app } = require('./dist/index');

const server = new proxy.Server(app);

module.exports.handler = function(req, resp, context) {
  server.httpProxy(req, resp, context);
};
