import { DownloadOutlined, SettingOutlined } from "@ant-design/icons";
import "./App.css";
import { useEffect, useRef, useState } from "react";
import { Select, Button, Form, message, Space, Modal, Input, FormInstance } from "antd";
import { MAP_CENTER } from "./Components/utils/const";
import { SimRaw } from "./Components/type";
import { Car, Replay } from "@fiblab/moss-replay/index";
import { LngLatZoom } from "@fiblab/moss-replay/src/_components/type";

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiZmh5ZHJhbGlzayIsImEiOiJja3VzMWc5NXkwb3RnMm5sbnVvd3IydGY0In0.FrwFkYIMpLbU83K9rHSe8w';

interface CarRaw {
    id: number,
    step: number,
    lat: number,
    lng: number,
    laneId: number,
    direction: number,
    v: number,
    model: string,
    numPassengers?: number,
}

interface PersonRaw {
    id: number,
    step: number,
    lat: number,
    lng: number,
    parentId: number,
    direction: number,
    v: number,
    model: string,
}

interface TLRaw {
    id: number,
    step: number,
    state: 0 | 1 | 2 | 3,
}

interface RoadStatusRaw {
    id: number,
    step: number,
    level: 0 | 1 | 2 | 3 | 4 | 5 | 6,
}


const useLoadForm = (apiUrl: string, setApiUrl: (string) => void) => {
    const [name, setName] = useState<string | undefined>(undefined);
    const [sim, setSim] = useState<SimRaw | undefined>(undefined);
    const [sims, setSims] = useState<SimRaw[]>([]);
    const [openModal, setOpenModal] = useState<boolean>(false);
    const formRef = useRef<FormInstance>();

    const updateSims = async () => {
        const simList = (await (await fetch(`${apiUrl}/sims`)).json()).data;
        setSims(simList);
    };

    const LoadForm = <Form
        layout="inline"
        onFinish={async (values) => {
            setName(values.name);
            setSim(sims.find((item) => item.name === values.name));
        }}
    >
        <Form.Item name="name">
            <Select
                style={{ width: "200px" }}
                placeholder={name ?? "Sim Name"}
                onDropdownVisibleChange={updateSims}
                options={sims.map((item) => {
                    return { label: item.name, value: item.name }
                })}
            />
        </Form.Item>
        <Button icon={<DownloadOutlined />} type="primary" htmlType="submit">
            Load
        </Button>
    </Form>

    const ApiUrlModal = <Modal
        title="Set API URL"
        open={openModal}
        onCancel={() => { setOpenModal(false) }}
        footer={null}
    >
        <Form
            ref={formRef}
            onFinish={async (values) => {
                localStorage.setItem("apiUrl", values.apiUrl);
                setApiUrl(values.apiUrl);
                message.success("API URL applied successfully.");
                setOpenModal(false);
            }}
        >
            <Form.Item
                name="apiUrl"
                label="API URL"
                shouldUpdate
            >
                <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit">
                Apply
            </Button>
        </Form>
    </Modal>

    const Body = (<Space>
        {LoadForm}
        {ApiUrlModal}
        <Button icon={<SettingOutlined />} onClick={() => {
            setOpenModal(true);
        }} />
    </Space>)

    useEffect(() => {
        // console.log("apiUrl changed", apiUrl);
        // console.log("formRef", formRef.current);
        // console.log("openModal", openModal);
        if (apiUrl !== "") {
            formRef.current?.setFieldsValue({ apiUrl });
            updateSims();
        }
    }, [apiUrl, openModal]);

    return {
        LoadForm: Body,
        sim,
    }
};

function App() {
    const [apiUrl, setApiUrl] = useState<string>('');
    const [mapCenter, setMapCenter] = useState<LngLatZoom>(MAP_CENTER);
    const { LoadForm, sim } = useLoadForm(apiUrl, setApiUrl);
    const [aoiGeoJson, setAoiGeoJson] = useState<GeoJSON.Feature[]>([]);
    const [allLaneGeoJson, setAllLaneGeoJson] = useState<GeoJSON.Feature[]>([]);
    const [roadGeoJson, setRoadGeoJson] = useState<GeoJSON.Feature[]>([]);
    const [junctionLaneGeoJson, setJunctionLaneGeoJson] = useState<GeoJSON.Feature[]>([]);

    const name = sim?.name;

    useEffect(() => {
        // load apiUrl from localStorage by key="apiUrl"
        const apiUrl = localStorage.getItem("apiUrl");
        if (apiUrl) {
            setApiUrl(apiUrl);
        } else {
            message.warning("Please input API URL by clicking the setting icon on the top right corner.");
        }
    }, []);

    useEffect(() => {
        if (sim) {
            setMapCenter({
                lng: (sim?.min_lng + sim?.max_lng) / 2,
                lat: (sim?.min_lat + sim?.max_lat) / 2,
                zoom: 12,
            });
            // 加载AOI GeoJSON
            // load AOI GeoJSON
            fetch(`${apiUrl}/aoi/${sim.name}`).then(res => res.json()).then(data => {
                setAoiGeoJson(data.data);
            });
            // 加载所有road lane geojson
            // load all road lane geojson
            fetch(`${apiUrl}/all-lane/${sim.name}`).then(res => res.json()).then(data => {
                setAllLaneGeoJson(data.data);
            });
            // 加载junctionLaneGeoJson
            // load junctionLaneGeoJson
            fetch(`${apiUrl}/junclane/${sim.name}`).then(res => res.json()).then(data => {
                setJunctionLaneGeoJson(data.data);
            });
            // 加载roadGeoJson
            // load roadGeoJson
            fetch(`${apiUrl}/roadlane/${sim.name}`).then(res => res.json()).then(data => {
                setRoadGeoJson(data.data);
            });
        }
    }, [sim]);

    return (<Replay
        sim={sim}
        mapCenter={mapCenter}
        onSetMapCenter={setMapCenter}
        onCarFetch={async (startT, endT, bound) => {
            startT = Math.floor(startT);
            endT = Math.ceil(endT);
            const res = await fetch(`${apiUrl}/cars/${name}?begin=${startT}&end=${endT}&lat1=${bound.lat1}&lat2=${bound.lat2}&lng1=${bound.lng1}&lng2=${bound.lng2}`);
            const raws = (await res.json()).data as CarRaw[];
            // 按照step分组并转换为CarFrame，然后排序
            // group by step and convert to CarFrame, then sort
            const groups = new Map<number, CarRaw[]>();
            for (let i = startT; i < endT; i++) {
                groups.set(i, []);
            }
            for (const raw of raws) {
                if (!groups.has(raw.step)) {
                    groups.set(raw.step, []);
                }
                groups.get(raw.step)?.push(raw);
            }
            const frames = Array.from(groups).map(([step, raws]) => {
                return {
                    t: step,
                    data: raws.map(raw => {
                        return {
                            id: raw.id,
                            lng: raw.lng,
                            lat: raw.lat,
                            direction: raw.direction,
                            laneId: raw.laneId,
                            model: raw.model,
                            v: raw.v,
                            numPassengers: raw.numPassengers,
                        } as Car
                    }),
                };
            });
            frames.sort((a, b) => a.t - b.t);
            return frames;
        }}
        onPedestrianFetch={async (startT, endT, bound) => {
            startT = Math.floor(startT);
            endT = Math.ceil(endT);
            const res = await fetch(`${apiUrl}/people/${name}?begin=${startT}&end=${endT}&lat1=${bound.lat1}&lat2=${bound.lat2}&lng1=${bound.lng1}&lng2=${bound.lng2}`);
            const raws = (await res.json()).data as PersonRaw[];
            // 按照step分组并转换为PedestrianFrame，然后排序
            // group by step and convert to PedestrianFrame, then sort
            const groups = new Map<number, PersonRaw[]>();
            for (let i = startT; i < endT; i++) {
                groups.set(i, []);
            }
            for (const raw of raws) {
                if (!groups.has(raw.step)) {
                    groups.set(raw.step, []);
                }
                groups.get(raw.step)?.push(raw);
            }
            const frames = Array.from(groups).map(([step, raws]) => {
                return {
                    t: step,
                    data: raws.map(raw => {
                        return {
                            id: raw.id,
                            lng: raw.lng,
                            lat: raw.lat,
                            direction: raw.direction,
                            parentId: raw.parentId,
                            model: raw.model,
                            v: raw.v,
                        }
                    }),
                };
            });
            frames.sort((a, b) => a.t - b.t);
            return frames;
        }}
        onTLFetch={async (startT, endT, bound) => {
            startT = Math.floor(startT);
            endT = Math.ceil(endT);
            const res = await fetch(`${apiUrl}/traffic-lights/${name}?begin=${startT}&end=${endT}&lat1=${bound.lat1}&lat2=${bound.lat2}&lng1=${bound.lng1}&lng2=${bound.lng2}`);
            const raws = (await res.json()).data as TLRaw[];
            // 按照step分组并转换为TLFrame，然后排序
            // group by step and convert to TLFrame, then sort
            const groups = new Map<number, TLRaw[]>();
            for (let i = startT; i < endT; i++) {
                groups.set(i, []);
            }
            for (const raw of raws) {
                if (!groups.has(raw.step)) {
                    groups.set(raw.step, []);
                }
                groups.get(raw.step)?.push(raw);
            }
            const frames = Array.from(groups).map(([step, raws]) => {
                return {
                    t: step,
                    data: raws.map(raw => {
                        return {
                            id: raw.id,
                            state: raw.state,
                        }
                    }),
                };
            });
            frames.sort((a, b) => a.t - b.t);
            let log = `onTLFetch: ${name} ${startT} ${endT}\n`;
            for (const frame of frames) {
                log += `frame ${frame.t}: `;
            }
            console.log(log);
            return frames;
        }}
        onRoadStatusFetch={async (startT, endT) => {
            startT = Math.floor(startT);
            endT = Math.ceil(endT);
            const res = await fetch(`${apiUrl}/road-status/${name}?begin=${startT}&end=${endT}`);
            const raws = (await res.json()).data as RoadStatusRaw[];
            // 按照step分组并转换为RoadStatusFrame，然后排序
            // group by step and convert to RoadStatusFrame, then sort
            const groups = new Map<number, RoadStatusRaw[]>();
            for (let i = startT; i < endT; i++) {
                groups.set(i, []);
            }
            for (const raw of raws) {
                if (!groups.has(raw.step)) {
                    groups.set(raw.step, []);
                }
                groups.get(raw.step)?.push(raw);
            }
            const frames = Array.from(groups).map(([step, raws]) => {
                return {
                    t: step,
                    data: raws.map(raw => {
                        return {
                            id: raw.id,
                            level: raw.level,
                        }
                    }),
                };
            });
            frames.sort((a, b) => a.t - b.t);
            return frames;
        }}
        aoiGeoJson={aoiGeoJson}
        allLaneGeoJson={allLaneGeoJson}
        roadGeoJson={roadGeoJson}
        junctionLaneGeoJson={junctionLaneGeoJson}
        carModelPaths={{
            "mini": "/moss-webui-frontend/models/cars/car_mini_red.gltf",
            "normal": "/moss-webui-frontend/models/cars/car_normal_red.gltf",
            "bus": "/moss-webui-frontend/models/cars/bus_green01.gltf",
        }}
        defaultCarModelPath="/moss-webui-frontend/models/cars/car_normal_red.gltf"
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        message={{
            info: (msg, duration) => message.info(msg, duration),
            success: (msg, duration) => message.success(msg, duration),
            warning: (msg, duration) => message.warning(msg, duration),
            error: (msg, duration) => message.error(msg, duration),
        }}
        extraHeader={LoadForm}
    />)
}

export default App;
