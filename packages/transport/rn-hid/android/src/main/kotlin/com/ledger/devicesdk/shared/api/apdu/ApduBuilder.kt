/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.api.apdu

import com.ledger.devicesdk.shared.api.utils.isHexadecimal
import com.ledger.devicesdk.shared.internal.transport.framer.model.MINIMUM_APDU_SIZE
import com.ledger.devicesdk.shared.internal.transport.utils.isHexadecimal
import kotlin.contracts.ExperimentalContracts
import kotlin.contracts.InvocationKind
import kotlin.contracts.contract
import kotlin.properties.Delegates

@OptIn(ExperimentalContracts::class)
public fun apdu(init: ApduBuilder.() -> Unit): Apdu {
    contract { callsInPlace(init, InvocationKind.EXACTLY_ONCE) }
    val builder = ApduBuilder()
    init.invoke(builder)
    return builder.build()
}

@OptIn(ExperimentalContracts::class)
public fun rawApdu(init: ApduRawBuilder.() -> Unit): Apdu {
    contract { callsInPlace(init, InvocationKind.EXACTLY_ONCE) }
    val builder = ApduRawBuilder()
    init.invoke(builder)
    return builder.build()
}

public class ApduBuilder internal constructor() {
    public var classInstruction: Byte by Delegates.notNull()
    public var instructionMethod: Byte by Delegates.notNull()
    public var parameter1: Byte by Delegates.notNull()
    public var parameter2: Byte by Delegates.notNull()
    public var data: ByteArray? = null

    internal fun build(): Apdu {
        check(classInstruction.isHexadecimal()) { "classInstruction must be a hexadecimal value" }
        check(instructionMethod.isHexadecimal()) { "instructionMethod must be a hexadecimal value" }
        check(parameter1.isHexadecimal()) { "parameter1 must be a hexadecimal value" }
        check(parameter2.isHexadecimal()) { "parameter2 must be a hexadecimal value" }
        if (data != null) {
            val internalData = data!!
            check(internalData.isHexadecimal()) { "data must be filled with a hexadecimal values" }
        }

        return Apdu(
            classInstruction = classInstruction,
            instructionMethod = instructionMethod,
            parameter1 = parameter1,
            parameter2 = parameter2,
            data = data,
            dataLength = data?.size ?: 0,
        )
    }
}

public class ApduRawBuilder internal constructor() {
    public var rawApdu: ByteArray? = null

    internal fun build(): Apdu {
        check(rawApdu != null) { "RawAPDU must be filled" }
        val apdu = rawApdu!!
        check(apdu.isHexadecimal()) { "APDU must be filled with hexadecimal values" }
        check(
            apdu.size >= MINIMUM_APDU_SIZE,
        ) {
            "APDU size is not correct : current size = ${apdu.size} / " +
                "minimum size must be = 4 (CLA / INS / P1 / P2)"
        }
        val data =
            if (apdu.size == MINIMUM_APDU_SIZE) {
                null
            } else {
                apdu.sliceArray(MINIMUM_APDU_SIZE..<apdu.size)
            }
        return Apdu(
            classInstruction = apdu[0],
            instructionMethod = apdu[1],
            parameter1 = apdu[2],
            parameter2 = apdu[3],
            data = data,
            dataLength = data?.size ?: 0,
        )
    }
}