import { createElement, Fragment } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { appRoutes } from '@/app/routes'
import { DebugStrip } from '@/widgets/debug-strip/ui/DebugStrip'

function RootFrame() {
  return createElement(Fragment, null, createElement(Outlet), createElement(DebugStrip))
}

export const router = createBrowserRouter([{ element: createElement(RootFrame), children: appRoutes }])
