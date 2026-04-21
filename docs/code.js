
function myInstanceof (left, right) {
   // 先判断是不是基本类型是基本类型直接返回
   if(typeof left !== 'object' || typeof left !== 'function') {
    return false;
   }
   if(left === null) {
    return false;
   }

   let obj = obj.__proto__; //Object.get

   while (obj !== null) {
    if(obj === right.prototype) {
        return true
    }
    obj = obj.__proto__;
   }
}

function myNew(func, ...args) {
    let obj = Object.create(func.prototype);
    let result = func.call(obj, ...args)
    return typeof result === 'object' ? result : obj;
}

function debounce (func, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer)
        timer = setTimeout(()=>{
            func.apply(this,args)
        },delay)
    }
}

function throttle (func ,delay) {
    let flag = false;
    return function(...args) {
        if(flag) return
        flag =true
        setTimeout(()=>{
            func.call(this,args)
        },delay)
    }
}

function deepClone (obj, map = new WeakMap()) {
    if(typeof obj !== 'object' || obj === null) {
        return obj;
    }
    if(obj instanceof Date) return new Date(obj)
    if(obj instanceof RegExp) return new Regrxt(obj)
    if(map.has(obj)) return map.get(obj)
    let clone = Array.isArray(obj)? []:{};
    for(let key in obj) {
        if(obj.hasOwnProperty(key)) {
            clone[key] = deepClone(obj[key],map)
        }
    }
    return clone;
}

function promiseAll(promises) {
    return new Promise((resolve, reject) => {
        let result = [];
        let count = 0;
        promises.forEach((pro, i) => {
            Promise.resolve(pro).then(res => {
                result[i] = res;
                if(++count === i) resolve(result)
            }).catch(reject)
        });
    })
}

function promisesRace(promises) {
    return new Promise((resolve,reject)=> {
        promises.forEach((pro)=>{
            Promise.resolve(pro).then(resolve).catch(reject)
        })
    })
}


function promiseAllSettled(promises) {
    return new Promsie((resolve,reject)=>{
        let result = [];
        let count = 0;
        promises.forEach((pro,i)=> {
            Promise.resolve(pro)
            .then((res)=>{
                result[i] = res;
            })
            .catch((rej)=>{
                result[j] = rej
            })
            .finally(()=>{
                if(++count === promises.length) resolve(result)
            })
        })
   })
}

function promiseAny(promises) {
    return new Promsie((resolve,reject)=>{
        let error = [];
        let count = 0;
        promises.forEach((pro,i)=> {
            Promise.resolve(pro)
            .then((res)=>{
               resolve(res)
            })
            .catch((rej)=>{
                error[i] = rej
                if(++count === promises.length) reject(error)
            })

        })
   })
}

function flat(arr) {
    return arr.reduce((pre, cur)=>{
        return Array.isArray(cur) ? pre.concat(flat(cur)) : pre.concat(cur)
    })
}

function yuxian(a,b) {
    let pot = 0;
    let norA =0;
    let norB =0;
    for(let i = 0; i<a.length;i++) {
        pot += a[i] * b[i];
        norA += a[i] * a[i];
        norB += b[i] * b[i];
    }
    return pot / (Math.sqrt(norA) * Math.sqrt(norB))
}

function tra () {
    const light = [
        {color: "红灯", duration: 3000},
        {color: "绿灯", duration: 2000},
        {color: "黄灯", duration: 1000}
    ]
    function run(i) {
        const {color, duration} = light[i % light.length];
        console.log(color);

        return new Promise((resolve) => {
            setTimeout(resolve,duration)
        }).then(()=> run(index + 1))
    } 
    run(0)
}
tra()

function taskPool(tasks) {

}

// "我们在提示词平台上，对同一个 prompt key 可以配置多个版本，
// 并设置各自的流量占比。请求提示词的时候会把用户ID带上，
// 平台用哈希取模的方式决定返回哪个版本，保证同一个用户始终落在同一个实验组。
// 业务调完 LLM 之后，会把本次用的 promptId 和用户反馈一起回传给平台做埋点统计。
// 平台会对比两个版本的好评率、重试率这些指标，
// 数据跑够了之后直接在平台上全量切版本，不需要发版，这就是我说的热更新和 A/B 结合的设计。"