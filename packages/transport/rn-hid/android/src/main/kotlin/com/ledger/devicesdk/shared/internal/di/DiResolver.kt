/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.di

import com.ledger.devicesdk.shared.internal.utils.Controller
import com.ledger.devicesdk.shared.internal.utils.getKoinOrThrow
import org.koin.core.KoinApplication
import org.koin.core.qualifier.named

private const val EXCEPTION_MSG = "Class not initialized. Please call LedgerDeviceSDK.build() first"


internal fun KoinApplication?.resolveControllers(qualifierNames: List<String>) =
    buildList {
        qualifierNames.forEach { name ->
            resolveControllers(qualifierName = name).forEach { add(it) }
        }
    }

internal fun KoinApplication?.resolveControllers(qualifierName: String) =
    getKoinOrThrow(msg = EXCEPTION_MSG).get<List<Controller>>(qualifier = named(qualifierName))
