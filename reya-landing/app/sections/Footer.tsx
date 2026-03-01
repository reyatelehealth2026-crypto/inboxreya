'use client'

import { MapPin, Phone, Mail, MessageCircle } from 'lucide-react'

const quickLinks = [
  { name: 'สินค้าทั้งหมด', href: '#products' },
  { name: 'เกี่ยวกับเรา', href: '#' },
  { name: 'การผลิต OEM', href: '#oem' },
  { name: 'ติดต่อเรา', href: '#contact' },
]

const socialLinks = [
  { name: 'Facebook', href: '#' },
  { name: 'Instagram', href: '#' },
  { name: 'TikTok', href: '#' },
  { name: 'LINE', href: '#' },
]

export default function Footer() {
  return (
    <footer id="contact" className="bg-dark text-white">
      <div className="section-padding py-16 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="text-2xl font-bold text-gold mb-4">
              Reya Soap
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              สบู่สมุนไพรออร์แกนิกคุณภาพสูง 
              13 ปีแห่งความไว้วางใจ
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-bold mb-4">เมนู</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href}
                    className="text-white/70 hover:text-gold transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold mb-4">ติดต่อเรา</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-white/70">
                <MapPin size={18} className="text-gold shrink-0 mt-0.5" />
                <span>บริษัท เลิศอนันต์ จำกัด</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <Phone size={18} className="text-gold shrink-0" />
                <span>โทร: [เบอร์โทร]</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <Mail size={18} className="text-gold shrink-0" />
                <span>contact@re-ya.com</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/70">
                <MessageCircle size={18} className="text-gold shrink-0" />
                <span>LINE: @reyaofficial</span>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-bold mb-4">ติดตามเรา</h4>
            <ul className="space-y-2">
              {socialLinks.map((link) => (
                <li key={link.name}>
                  <a 
                    href={link.href}
                    className="text-white/70 hover:text-gold transition-colors text-sm"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-white/10">
        <div className="section-padding py-6 max-w-7xl mx-auto">
          <p className="text-center text-white/50 text-sm">
            © 2024 Reya Soap. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
