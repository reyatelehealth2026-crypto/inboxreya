'use client'

import { motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef } from 'react'
import { Leaf, Shield, Award, Heart } from 'lucide-react'

const features = [
  {
    icon: Leaf,
    title: 'สมุนไพรแท้ 100%',
    description: 'คัดสรรสมุนไพรคุณภาพ ไม่ผสมสารเคมีอันตราย',
  },
  {
    icon: Shield,
    title: 'ไร้สารอันตราย',
    description: 'ไม่มี SLS, Paraben, หรือสารกันบูด ปลอดภัยแม้ผิวแพ้ง่าย',
  },
  {
    icon: Award,
    title: '13 ปีแห่งความเชื่อมั่น',
    description: 'สูตรพิสูจน์แล้วจากลูกค้านับหมื่นราย',
  },
  {
    icon: Heart,
    title: 'Cruelty-Free',
    description: 'ไม่ทดลองกับสัตว์ เป็นมิตรต่อสิ่งแวดล้อม',
  },
]

export default function WhySection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section className="py-20 bg-white" ref={ref}>
      <div className="section-padding max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-primary font-medium">ทำไมต้องเรยา?</span>
          <h2 className="text-3xl md:text-4xl font-bold text-dark mt-2 mb-4">
            ความตั้งใจใน Every Bar
          </h2>
          <p className="text-muted max-w-xl mx-auto">
            ทุกก้อนสบู่ที่เราผลิต เต็มไปด้วยความใส่ใจ
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center p-6"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                <feature.icon size={32} />
              </div>
              
              <h3 className="text-xl font-bold text-dark mb-3">
                {feature.title}
              </h3>
              
              <p className="text-muted">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
