'use client'

import { motion } from 'framer-motion'
import { ChevronDown, ShoppingBag, Factory } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-primary">
        <div className="absolute inset-0 opacity-20" 
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
             }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 section-padding text-center max-w-5xl mx-auto pt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-block px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-6">
            🌿 สบู่สมุนไพรออร์แกนิก
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6"
        >
          13 ปี ที่ผิวสวยต้องมาก่อน
          <span className="block text-gold mt-2">กำไรต้องมาทีหลัง</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          สบู่สมุนไพรออร์แกนิกจากธรรมชาติ สูตรพิสูจน์แล้วจากลูกค้านับหมื่น
          <br className="hidden sm:block" />
          ผิวสวยที่ยั่งยืนเริ่มต้นที่นี่
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <a href="#products" className="btn-primary flex items-center gap-2 text-lg">
            <ShoppingBag size={20} />
            เลือกซื้อสบู่
          </a>
          <a href="#oem" className="btn-secondary bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white hover:text-primary flex items-center gap-2 text-lg">
            <Factory size={20} />
            สนใจผลิต OEM
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <a href="#stats" className="text-white/60 hover:text-white transition-colors animate-bounce">
            <ChevronDown size={32} />
          </a>
        </motion.div>
      </div>
    </section>
  )
}
