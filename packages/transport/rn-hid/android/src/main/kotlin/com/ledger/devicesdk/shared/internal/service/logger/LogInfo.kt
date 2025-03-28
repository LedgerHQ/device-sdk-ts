/*
 * SPDX-FileCopyrightText: 2024 Ledger SAS
 * SPDX-License-Identifier: LicenseRef-LEDGER
 */

package com.ledger.devicesdk.shared.internal.service.logger

internal data class LogInfo(
    val level: LogLevel,
    val tag: String,
    val message: String,
    val jsonPayLoad: Map<String, String>,
)

internal fun buildSimpleDebugLogInfo(
    tag: String,
    message: String,
): LogInfo =
    LogInfo(level = LogLevel.DEBUG, tag = tag, message = message, emptyMap())

internal fun buildSimpleErrorLogInfo(
    tag: String,
    message: String,
): LogInfo =
    LogInfo(level = LogLevel.ERROR, tag = tag, message = message, emptyMap())

internal fun buildSimpleWarningLogInfo(
    tag: String,
    message: String,
): LogInfo =
    LogInfo(level = LogLevel.WARNING, tag = tag, message = message, emptyMap())

internal fun buildSimpleInfoLogInfo(
    tag: String,
    message: String,
): LogInfo =
    LogInfo(level = LogLevel.INFO, tag = tag, message = message, emptyMap())

private fun buildSimpleLogInfo(
    level: LogLevel,
    tag: String,
    message: String,
): LogInfo =
    LogInfo(level = level, tag = tag, message = message, emptyMap())

internal fun buildComplexLogInfo(
    level: LogLevel,
    tag: String,
    message: String,
    jsonPayLoad: Map<String, String>,
): LogInfo =
    LogInfo(level = level, tag = tag, message = message, jsonPayLoad = jsonPayLoad)