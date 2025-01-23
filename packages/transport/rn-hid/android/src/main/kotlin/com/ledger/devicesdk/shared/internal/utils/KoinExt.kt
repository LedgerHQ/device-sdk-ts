/*
 * SPDX-FileCopyrightText: 2023 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.utils

import org.koin.core.Koin
import org.koin.core.KoinApplication

//todo: might move in a kmp library
internal fun KoinApplication?.getKoinOrThrow(msg: String = ""): Koin {
    return this?.koin
        ?: throw IllegalStateException(msg)
}