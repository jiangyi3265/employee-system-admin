# Employee System Admin

员工系统管理后台，基于 Vue3 与 Vite 构建，面向管理员提供用户、角色、菜单、员工档案、客户档案、系统监控、代码生成等后台管理能力，并通过后端服务完成数据读写与权限校验。

## 技术栈

- Vue 3
- Vite
- Element Plus
- Pinia
- Vue Router
- Axios
- ECharts
- Sass

## 关联仓库

| 子项目 | 仓库 | 说明 |
| --- | --- | --- |
| 后端服务 | [employee-system-backend](https://github.com/jiangyi3265/employee-system-backend) | 提供认证、权限、系统管理和员工档案等 API |
| 管理后台 | [employee-system-admin](https://github.com/jiangyi3265/employee-system-admin) | 面向管理员的 Web 管理端 |
| 用户端 | [employee-system-app](https://github.com/jiangyi3265/employee-system-app) | 面向员工、客户和移动端场景的应用 |

## 快速启动

```bash
# 安装依赖
npm install

# 修改接口地址
# .env.development

# 本地开发
npm run dev

# 生产构建
npm run build:prod
```

启动后访问终端输出的本地地址，接口服务默认对接 `employee-system-backend`。

## 简历描述示例

负责员工系统管理后台开发，基于 Vue3、Vite、Element Plus 和 Pinia 实现权限路由、后台表单、数据列表、系统监控和业务档案管理，提高企业内部人员与客户资料维护效率。
