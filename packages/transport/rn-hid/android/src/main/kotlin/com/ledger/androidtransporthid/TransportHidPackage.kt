package com.ledger.androidtransporthid

import android.view.View
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers

class TransportHidPackage() : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> {
        return mutableListOf(
            TransportHidModule(
                reactContext = reactContext,
                coroutineScope = CoroutineScope(Dispatchers.Default)
            )
        )
    }

    override fun createViewManagers(p0: ReactApplicationContext): MutableList<ViewManager<View, ReactShadowNode<*>>> {
        return mutableListOf()
    }
}