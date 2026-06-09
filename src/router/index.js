import { createWebHistory, createRouter } from 'vue-router'
/* Layout */
import Layout from '@/layout'
import ParentView from '@/components/ParentView'

/**
 * Note: 路由配置项
 *
 * hidden: true                     // 当设置 true 的时候该路由不会再侧边栏出现 如401，login等页面，或者如一些编辑页面/edit/1
 * alwaysShow: true                 // 当你一个路由下面的 children 声明的路由大于1个时，自动会变成嵌套的模式--如组件页面
 *                                  // 只有一个时，会将那个子路由当做根路由显示在侧边栏--如引导页面
 *                                  // 若你想不管路由下面的 children 声明的个数都显示你的根路由
 *                                  // 你可以设置 alwaysShow: true，这样它就会忽略之前定义的规则，一直显示根路由
 * redirect: noRedirect             // 当设置 noRedirect 的时候该路由在面包屑导航中不可被点击
 * name:'router-name'               // 设定路由的名字，一定要填写不然使用<keep-alive>时会出现各种问题
 * query: '{"id": 1, "name": "ry"}' // 访问路由的默认传递参数
 * roles: ['admin', 'common']       // 访问路由的角色权限
 * permissions: ['a:a:a', 'b:b:b']  // 访问路由的菜单权限
 * meta : {
    noCache: true                   // 如果设置为true，则不会被 <keep-alive> 缓存(默认 false)
    title: 'title'                  // 设置该路由在侧边栏和面包屑中展示的名字
    icon: 'svg-name'                // 设置该路由的图标，对应路径src/assets/icons/svg
    breadcrumb: false               // 如果设置为false，则不会在breadcrumb面包屑中显示
    activeMenu: '/system/user'      // 当路由设置了该属性，则会高亮相对应的侧边栏。
  }
 */

// 公共路由
function businessLeaf(table, name, title, icon) {
  return {
    path: table,
    component: () => import('@/views/business/sqms/index'),
    name,
    meta: { title, icon }
  }
}

function businessRedirect(table, target) {
  return { path: table, redirect: target, hidden: true }
}

export const constantRoutes = [
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/views/redirect/index.vue')
      }
    ]
  },
  {
    path: '/login',
    component: () => import('@/views/login'),
    hidden: true
  },
  {
    path: '/register',
    component: () => import('@/views/register'),
    hidden: true
  },
  {
    path: "/:pathMatch(.*)*",
    component: () => import('@/views/error/404'),
    hidden: true
  },
  {
    path: '/401',
    component: () => import('@/views/error/401'),
    hidden: true
  },
  {
    path: '',
    component: Layout,
    redirect: '/index',
    hidden: true,
    children: [
      {
        path: '/index',
        component: () => import('@/views/index'),
        name: 'Index',
        meta: { title: '首页', icon: 'dashboard', affix: false }
      }
    ]
  },
  {
    path: '/user',
    component: Layout,
    hidden: true,
    redirect: 'noredirect',
    children: [
      {
        path: 'profile/:activeTab?',
        component: () => import('@/views/system/user/profile/index'),
        name: 'Profile',
        meta: { title: '个人中心', icon: 'user' }
      }
    ]
  },
  {
    path: '/business',
    component: Layout,
    redirect: '/business/base/products',
    alwaysShow: true,
    name: 'Business',
    meta: { title: '业务管理', icon: 'table' },
    children: [
      {
        path: 'base',
        component: ParentView,
        redirect: '/business/base/products',
        alwaysShow: true,
        name: 'BusinessBase',
        meta: { title: '基础信息', icon: 'documentation' },
        children: [
          businessLeaf('employees', 'BusinessEmployees', '员工', 'user'),
          businessLeaf('customers', 'BusinessCustomers', '客户', 'peoples'),
          businessLeaf('products', 'BusinessProducts', '商品', 'shopping'),
          businessLeaf('competitors', 'BusinessCompetitors', '同行', 'people'),
          businessLeaf('suppliers', 'BusinessSuppliers', '供货商', 'shopping')
        ]
      },
      {
        path: 'quote',
        component: ParentView,
        redirect: '/business/quote/quoteOrders',
        alwaysShow: true,
        name: 'BusinessQuote',
        meta: { title: '报价接单', icon: 'money' },
        children: [
          businessLeaf('quoteOrders', 'BusinessQuoteOrders', '报价单', 'money'),
          businessLeaf('requestOrders', 'BusinessRequestOrders', '接单', 'form'),
          businessLeaf('competitorQuotes', 'BusinessCompetitorQuotes', '同行报价', 'chart')
        ]
      },
      {
        path: 'purchase',
        component: ParentView,
        redirect: '/business/purchase/purchaseOrders',
        alwaysShow: true,
        name: 'BusinessPurchase',
        meta: { title: '采购跟进', icon: 'shopping' },
        children: [
          businessLeaf('purchaseOrders', 'BusinessPurchaseOrders', '采购', 'shopping'),
          businessLeaf('follows', 'BusinessFollows', '跟进', 'phone')
        ]
      },
      {
        path: 'communication',
        component: ParentView,
        redirect: '/business/communication/messages',
        alwaysShow: true,
        name: 'BusinessCommunication',
        meta: { title: '沟通配置', icon: 'message' },
        children: [
          businessLeaf('suggestions', 'BusinessSuggestions', '建议', 'message'),
          businessLeaf('messages', 'BusinessMessages', '消息', 'email'),
          businessLeaf('settings', 'BusinessSettings', '设置', 'system')
        ]
      },
      {
        path: 'quoteItems',
        redirect: '/business/quote/quoteOrders',
        hidden: true
      },
      {
        path: 'requestItems',
        redirect: '/business/quote/requestOrders',
        hidden: true
      },
      {
        path: 'purchaseItems',
        redirect: '/business/purchase/purchaseOrders',
        hidden: true
      },
      businessRedirect('employees', '/business/base/employees'),
      businessRedirect('customers', '/business/base/customers'),
      businessRedirect('products', '/business/base/products'),
      businessRedirect('competitors', '/business/base/competitors'),
      businessRedirect('suppliers', '/business/base/suppliers'),
      businessRedirect('quoteOrders', '/business/quote/quoteOrders'),
      businessRedirect('requestOrders', '/business/quote/requestOrders'),
      businessRedirect('competitorQuotes', '/business/quote/competitorQuotes'),
      businessRedirect('purchaseOrders', '/business/purchase/purchaseOrders'),
      businessRedirect('follows', '/business/purchase/follows'),
      businessRedirect('suggestions', '/business/communication/suggestions'),
      businessRedirect('messages', '/business/communication/messages'),
      businessRedirect('settings', '/business/communication/settings'),
      {
        path: 'sqms',
        redirect: '/business/base/products',
        hidden: true
      }
    ]
  }
]

// 动态路由，基于用户权限动态去加载
export const dynamicRoutes = [
  {
    path: '/system/user-auth',
    component: Layout,
    hidden: true,
    permissions: ['system:user:edit'],
    children: [
      {
        path: 'role/:userId(\\d+)',
        component: () => import('@/views/system/user/authRole'),
        name: 'AuthRole',
        meta: { title: '分配角色', activeMenu: '/system/user' }
      }
    ]
  },
  {
    path: '/system/role-auth',
    component: Layout,
    hidden: true,
    permissions: ['system:role:edit'],
    children: [
      {
        path: 'user/:roleId(\\d+)',
        component: () => import('@/views/system/role/authUser'),
        name: 'AuthUser',
        meta: { title: '分配用户', activeMenu: '/system/role' }
      }
    ]
  },
  {
    path: '/system/dict-data',
    component: Layout,
    hidden: true,
    permissions: ['system:dict:list'],
    children: [
      {
        path: 'index/:dictId(\\d+)',
        component: () => import('@/views/system/dict/data'),
        name: 'Data',
        meta: { title: '字典数据', activeMenu: '/system/dict' }
      }
    ]
  },
  {
    path: '/monitor/job-log',
    component: Layout,
    hidden: true,
    permissions: ['monitor:job:list'],
    children: [
      {
        path: 'index/:jobId(\\d+)',
        component: () => import('@/views/monitor/job/log'),
        name: 'JobLog',
        meta: { title: '调度日志', activeMenu: '/monitor/job' }
      }
    ]
  },
  {
    path: '/tool/gen-edit',
    component: Layout,
    hidden: true,
    permissions: ['tool:gen:edit'],
    children: [
      {
        path: 'index/:tableId(\\d+)',
        component: () => import('@/views/tool/gen/editTable'),
        name: 'GenEdit',
        meta: { title: '修改生成配置', activeMenu: '/tool/gen' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

export default router
