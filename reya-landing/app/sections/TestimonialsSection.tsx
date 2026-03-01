'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    quote: 'ใช้สบู่ซัลเฟอร์มา 2 อาทิตย์ สิวหายเกลี้ยงเลยค่ะ ผิวไม่แห้งด้วย',
    author: 'คุณนิดา',
    location: 'กรุงเทพฯ',
    product: 'สบู่ซัลเฟอร์ลดสิว',
  },
  {
    quote: 'อาโวคาโด้คือดีมาก อาบน้ำเสร็จผิวนุ่มไม่ต้องทาโลชั่นเลย',
    author: 'คุณต้น',
    location: 'เชียงใหม่',
    product: 'สบู่อาโวคาโด้',
  },
  {
    quote: 'สั่งผลิต OEM กับเรยา แพคเกจสวย คุณภาพดี ลูกค้าติดใจมาก',
    author: 'เจ้าของแบรนด์ Anako',
    location: 'OEM Partner',
    product: 'OEM Service',
  },
]

export default function TestimonialsSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="py-20 bg-primary" ref={ref}>
      <div className="section-padding max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-gold font-medium">เสียงจากผิวสวย</span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mt-2 mb-4">
            รีวิวจริงจากลูกค้าตัวจริง
          </h2>
          <p className="text-white/70 max-w-xl mx-auto">
            ความประทับใจที่แชร์ต่อกัน
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-8"
            >
              <Quote className="text-gold mb-4" size={32} />
              
              <p className="text-white text-lg mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>
              
              <div className="border-t border-white/20 pt-4">
                <div className="text-white font-medium">
                  {testimonial.author}
                </div>
                <div className="text-white/60 text-sm">
                  {testimonial.location}
                </div>
                <div className="text-gold text-sm mt-1">
                  {testimonial.product}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
