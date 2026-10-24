package com.sleepypay.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpiParserTest {

    @Test fun validAndInvalidVpa() {
        assertTrue(UpiParser.isValidVpa("shop.1@okbank"))
        assertTrue(UpiParser.isValidVpa("a-b_c@ybl"))
        assertTrue(!UpiParser.isValidVpa("nohandle"))
        assertTrue(!UpiParser.isValidVpa("x@"))
        assertTrue(!UpiParser.isValidVpa("@bank"))
    }

    @Test fun amountNormalization() {
        assertEquals("10.00", UpiParser.normalizeAmount("10"))
        assertEquals("10.50", UpiParser.normalizeAmount("10.5"))
        assertEquals("99.99", UpiParser.normalizeAmount(" 99.99 "))
        assertNull(UpiParser.normalizeAmount("0"))
        assertNull(UpiParser.normalizeAmount("-5"))
        assertNull(UpiParser.normalizeAmount("1.234"))
        assertNull(UpiParser.normalizeAmount("abc"))
    }

    @Test fun parsesMerchantQr() {
        val r = UpiParser.parseLink("upi://pay?pa=chai.wala@okaxis&pn=Chai%20Wala&am=20&cu=INR&tn=Tea")
        val p = (r as UpiParser.Result.Ok).payment
        assertEquals("chai.wala@okaxis", p.vpa)
        assertEquals("Chai Wala", p.name)
        assertEquals("20.00", p.amount)
        assertEquals("Tea", p.note)
    }

    @Test fun qrWithoutAmount() {
        val r = UpiParser.parseLink("upi://pay?pa=shop@ybl&pn=Shop") as UpiParser.Result.Ok
        assertNull(r.payment.amount)
    }

    @Test fun rejectsBadLinks() {
        assertTrue(UpiParser.parseLink("https://example.com") is UpiParser.Result.Error)
        assertTrue(UpiParser.parseLink("upi://pay?pn=NoId") is UpiParser.Result.Error)
        assertTrue(UpiParser.parseLink("upi://pay?pa=bad&am=5") is UpiParser.Result.Error)
        assertTrue(UpiParser.parseLink("upi://pay?pa=shop@ybl&am=-3") is UpiParser.Result.Error)
        assertTrue(UpiParser.parseLink("upi://pay?pa=shop@ybl&pn=%ZZ") is UpiParser.Result.Error)
    }

    @Test fun parseAnyAcceptsBareVpa() {
        assertTrue(UpiParser.parseAny("  friend@okhdfcbank ") is UpiParser.Result.Ok)
        assertTrue(UpiParser.parseAny("hello world") is UpiParser.Result.Error)
    }
}
