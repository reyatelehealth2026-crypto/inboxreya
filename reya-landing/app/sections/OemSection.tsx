'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Package, FlaskConical, Palette, Factory, ArrowRight } from 'lucide-react'

const benefits = [
  {
    icon: Package,
    title: 'MOQ เริ่มต้นต่ำ',
    description: 'เริ่มธุรกิจได้ง่าย ไม่ต้องสต็อกเยอะ',
  },
  {
    icon: FlaskConical,
    title: 'สูตรพร้อมใช้',
    description: 'หรือปรับสูตรตามความต้องการของคุณ',
  },
  {
    icon: Palette,
    title: 'ดีไซน์แพคเกจครบ',
    description: 'เราจัดการให้ทั้งหมด ตั้งแต่ขวดถึงกล่อง',
  },
  {
    icon: Factory,
    title: 'โรงงานมาตรฐาน GMP',
    description: 'การันตีคุณภาพทุกกระบวนการผลิต',
  },
]

export default function OemSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="oem" className="py-20 bg-cream" ref={ref}>
      <div className="section-padding max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="text-primary font-medium">สำหรับธุรกิจ</span>
            <h2 className="text-3xl md:text-4xl font-bold text-dark mt-2 mb-4">
              อยากมีแบรนด์สบู่
              <span className="text-primary">เป็นของตัวเอง?</span>
            </h2>
            
            <p className="text-muted text-lg mb-8">
              เรยารับผลิตสบู่ OEM ให้แบรนด์คุณโดดเด่น 
              ด้วยประสบการณ์ 13 ปี เราพร้อมช่วยให้ธุรกิจคุณเติบโต
            </p>

            <a href="#contact" className="btn-primary inline-flex items-center gap-2 text-lg">
              ปรึกษาการผลิตฟรี
              <ArrowRight size={20} />
            </a>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
                  <benefit.icon size={24} />
                </div>
                
                <h3 className="text-lg font-bold text-dark mb-2">
                  {benefit.title}
                </h3>
                
                <p className="text-muted text-sm">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
