package com.ledger.androidtransporthid

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

class TransportHidPackage(): ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): MutableList<NativeModule> {
        return mutableListOf(
            TransportHidModule(context)
        )
    }

    override fun createViewManagers(p0: ReactApplicationContext): MutableList<ViewManager<View, ReactShadowNode<*>>> {
        return mutableListOf()
    }
}